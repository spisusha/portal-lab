import { useEffect, useRef, useState } from 'react'
import { useLab } from '../state/labStore'
import { SCENARIO_TITLES } from '../domain/reducer'
import { CYCLE_MINUTES, currentCycle, formatClock, isActive, type ScenarioId } from '../domain/types'
import { createSeedCode } from '../state/liveSeed'
import { counted, plural } from './plural'

/**
 * Порядок режимов: сначала три детерминированных набора, которыми проверяют
 * обязательные состояния задания, и только потом переигрываемая смена.
 * Живая смена стоит последней намеренно — она не должна открываться первой
 * у человека, который пришёл проверять работу.
 */
const SCENARIOS: ScenarioId[] = ['standard', 'critical', 'empty', 'live']

const SCENARIO_HINTS: Record<ScenarioId, string> = {
  standard: 'Обычная смена: ранги от E до A',
  critical: 'Есть портал ранга S и портал, который схлопнется за один цикл',
  empty: 'Пустой список порталов',
  live: 'Новая смена по коду: свои порталы, особенности миров, события и директива',
}

export type Tab = 'lab' | 'worklog'

/**
 * Верхняя панель поста: кто здесь работает, сколько времени, что горит,
 * какие данные загружены и как двинуть время.
 *
 * Переключатель наборов называется «Демо-сценарий», а не «Смена»: раньше
 * подпись читалась как часть игры, и было неясно, что это инструмент
 * проверяющего, а не действие смотрителя.
 *
 * Кнопка цикла ненадолго блокируется после нажатия. Это не имитация
 * загрузки — сетевых запросов здесь нет. Блокировка защищает от двойного
 * клика, из-за которого смена перескакивала бы сразу на два цикла.
 */
export function TopBar({
  tab,
  onTabChange,
  onShowIntro,
}: {
  tab: Tab
  onTabChange: (tab: Tab) => void
  onShowIntro: () => void
}) {
  const { state, summary, forecast, dispatch } = useLab()
  const [advancing, setAdvancing] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const advancingRef = useRef(false)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const nextCycle = () => {
    if (advancingRef.current || state.shiftStatus === 'COMPLETE') return
    const pending = state.portals.filter(
      (portal) => isActive(portal) && portal.decisionCycle !== currentCycle(state),
    ).length
    if (pending > 0) {
      dispatch({ type: 'NEXT_CYCLE' })
      return
    }
    advancingRef.current = true
    dispatch({ type: 'NEXT_CYCLE' })
    setAdvancing(true)
    timer.current = window.setTimeout(() => {
      advancingRef.current = false
      setAdvancing(false)
    }, 420)
  }

  return (
    <header className="topbar">
      <div className="topbar__identity">
        <LabSigil />
        <div className="topbar__names">
          <h1 className="topbar__title">Лаборатория нестабильных порталов</h1>
          <p className="topbar__goal">
            Исследовательский пост. Сохраняйте ценные проходы и защищайте
            лабораторию и существ от неконтролируемого схлопывания.
          </p>
        </div>
      </div>

      <div className="topbar__state">
        <p
          className="topbar__clock"
          aria-label={`Смена ${formatClock(state.clockMinutes)}`}
        >
          <span className="topbar__clock-label">Смена</span>
          <span className="topbar__clock-value">
            {formatClock(state.clockMinutes)}
          </span>
        </p>

        <CriticalTally
          dangerous={summary.critical}
          critical={summary.sRank}
          active={summary.active}
          collapsed={summary.collapsed}
        />
      </div>

      <div className="topbar__tools">
        <label className="picker">
          <span className="picker__label">Режим смены</span>
          <select
            value={state.scenario}
            title={SCENARIO_HINTS[state.scenario]}
            onChange={(event) => {
              const scenario = event.target.value as ScenarioId
              dispatch({
                type: 'LOAD_SCENARIO',
                scenario,
                // Код придумывает адаптер, а не домен: внутри домена
                // источников случайности нет.
                seed: scenario === 'live' ? createSeedCode() : undefined,
              })
            }}
          >
            {SCENARIOS.map((scenario) => (
              <option key={scenario} value={scenario}>
                {SCENARIO_TITLES[scenario]}
              </option>
            ))}
          </select>
        </label>

        {/* Код смены — служебная подпись. Он не должен спорить за внимание
            с рангом портала и кнопками решений, поэтому стоит под
            переключателем мелким шрифтом. */}
        {state.live && (
          <p className="seedtag">
            <span className="seedtag__label">Код смены</span>
            <code className="seedtag__value">{state.live.seed}</code>
          </p>
        )}

        <button type="button" className="btn btn--ghost" onClick={onShowIntro}>
          Как это работает
        </button>
      </div>

      <div className="topbar__deck">
        <nav className="tabs" aria-label="Разделы">
          {(['lab', 'worklog'] as Tab[]).map((item) => (
            <button
              key={item}
              type="button"
              className={`tab${tab === item ? ' tab--active' : ''}`}
              aria-current={tab === item}
              onClick={() => onTabChange(item)}
            >
              {item === 'lab' ? 'Лаборатория' : 'AI Worklog'}
            </button>
          ))}
        </nav>

        {/* Прогноз стоит вплотную к кнопке: время не двигают вслепую. */}
        {state.shiftStatus === 'COMPLETE' ? (
          <div className="cycle cycle--calm cycle--complete" data-tour="cycle">
            <p className="cycle__forecast">
              <span className="cycle__forecast-label">Смена завершена</span>
              Итоговый отчёт готов: решения больше не принимаются.
            </p>
          </div>
        ) : (
          <div className={`cycle cycle--${forecast.tone}`} data-tour="cycle">
            <p className="cycle__forecast">
              <span className="cycle__forecast-label">Через цикл</span>
              {forecast.headline}
            </p>
            {/* Событие живой смены объявляется здесь же и заранее: никаких
                внезапных окон после нажатия. */}
            {forecast.event && forecast.eventText && (
              <p className={`cycle__event cycle__event--${forecast.event.tone}`}>
                <span className="cycle__event-label">{forecast.event.title}</span>
                {forecast.eventText}
              </p>
            )}
            <button
              type="button"
              className="btn btn--primary"
              onClick={nextCycle}
              disabled={advancing}
              aria-busy={advancing}
            >
              {advancing ? 'Цикл идёт…' : `Следующий цикл · +${CYCLE_MINUTES} мин`}
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

/**
 * Счётчик тревоги. Число критических порталов — единственная цифра,
 * ради которой человек поднимает глаза к шапке, поэтому она подписана
 * словом и снабжена знаком: одного красного цвета мало.
 */
function CriticalTally({
  dangerous,
  critical,
  active,
  collapsed,
}: {
  dangerous: number
  critical: number
  active: number
  collapsed: number
}) {
  const tone = critical > 0 ? 'alarm' : dangerous > 0 ? 'warning' : 'clear'

  return (
    <div
      className={`tally tally--${tone}`}
      aria-label={
        critical > 0
          ? `${critical} критических из ${active} активных`
          : dangerous > 0
            ? `${dangerous} опасный из ${active} активных`
            : `Опасных нет, активно ${active}`
      }
    >
      <svg className="tally__mark" viewBox="0 0 24 24" aria-hidden="true">
        {critical > 0 || dangerous > 0 ? (
          <>
            <path d="M12 2.5 L22 20 L2 20 Z" />
            <path d="M12 9 L12 14" />
            <path d="M12 16.6 L12 16.7" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M7.5 12.3 L10.6 15.4 L16.5 9.5" />
          </>
        )}
      </svg>
      <span className="tally__text">
          {critical > 0 ? (
            <>
              <strong>{critical}</strong>{' '}
              {plural(critical, 'критический', 'критических', 'критических')} из{' '}
              {counted(active, 'активного', 'активных', 'активных')}
            </>
          ) : dangerous > 0 ? (
            <>
              <strong>{dangerous}</strong>{' '}
              {plural(dangerous, 'опасный', 'опасных', 'опасных')} из{' '}
              {counted(active, 'активного', 'активных', 'активных')}
            </>
          ) : (
            <>Опасных нет · активно {active}</>
          )}
      </span>
      {collapsed > 0 && (
        <span className="tally__lost">схлопнулось {collapsed}</span>
      )}
    </div>
  )
}

/** Печать лаборатории: шестиугольник обсерватории с проёмом внутри. */
function LabSigil() {
  return (
    <svg className="sigil" viewBox="0 0 40 44" aria-hidden="true">
      <path
        className="sigil__frame"
        d="M20 1.5 L37.5 11.5 L37.5 32.5 L20 42.5 L2.5 32.5 L2.5 11.5 Z"
      />
      <circle className="sigil__ring" cx="20" cy="22" r="10" />
      <circle className="sigil__core" cx="20" cy="22" r="4" />
      <path className="sigil__rays" d="M20 4.5 L20 9 M20 35 L20 39.5" />
    </svg>
  )
}
