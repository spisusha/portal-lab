import { useEffect, useRef, useState } from 'react'
import { useLab } from '../state/labStore'
import { SCENARIO_TITLES } from '../domain/reducer'
import { CYCLE_MINUTES, formatClock, type ScenarioId } from '../domain/types'

const SCENARIOS: ScenarioId[] = ['standard', 'critical', 'empty']

const SCENARIO_HINTS: Record<ScenarioId, string> = {
  standard: 'Обычная смена: ранги от E до A',
  critical: 'Есть портал ранга S и портал, который схлопнется за один цикл',
  empty: 'Пустой список порталов',
}

/**
 * Шапка смены: кто вы, сколько времени, какая смена загружена и главная
 * кнопка хода времени.
 *
 * Демо-сценарии переехали сюда из отдельной панели над экраном. Раньше
 * первым, что видел человек, был переключатель тестовых данных — служебный
 * инструмент стоял выше цели работы. Теперь он компактен и не мешает, но
 * остаётся под рукой у проверяющего.
 *
 * Кнопка цикла ненадолго блокируется после нажатия. Это не имитация
 * загрузки: сетевых запросов здесь нет. Блокировка защищает от двойного
 * клика, из-за которого смена перескакивала бы сразу на два цикла, пока
 * показатели ещё анимируются.
 */
export function ShiftHeader({ onShowIntro }: { onShowIntro: () => void }) {
  const { state, summary, dispatch } = useLab()
  const [advancing, setAdvancing] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const nextCycle = () => {
    dispatch({ type: 'NEXT_CYCLE' })
    setAdvancing(true)
    timer.current = window.setTimeout(() => setAdvancing(false), 420)
  }

  return (
    <header className="shift">
      <div className="shift__top">
        <div>
          <p className="shift__role">Пост смотрителя · лаборатория порталов</p>
          <h1 className="shift__title">Лаборатория нестабильных порталов</h1>
        </div>

        <div className="shift__controls">
          <button type="button" className="btn btn--ghost" onClick={onShowIntro}>
            Как это работает
          </button>

          <label className="shift__select">
            <span className="shift__select-label">Смена</span>
            <select
              value={state.scenario}
              title={SCENARIO_HINTS[state.scenario]}
              onChange={(event) =>
                dispatch({
                  type: 'LOAD_SCENARIO',
                  scenario: event.target.value as ScenarioId,
                })
              }
            >
              {SCENARIOS.map((scenario) => (
                <option key={scenario} value={scenario}>
                  {SCENARIO_TITLES[scenario]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Постоянное напоминание о цели: модалка исчезнет, а строка останется. */}
      <div className="goal">
        <p className="goal__text">
          <strong>Ваша задача:</strong> не допустить неконтролируемого
          схлопывания порталов. Время идёт только по вашей команде.
        </p>

        <div className="goal__side">
          <span className="goal__clock">
            Смена {formatClock(state.clockMinutes)}
          </span>
          <span className="goal__counts">
            открыто {summary.active} · критичных {summary.critical} · схлопнулось{' '}
            {summary.collapsed}
          </span>
          <button
            type="button"
            className="btn btn--primary"
            onClick={nextCycle}
            disabled={advancing}
            aria-busy={advancing}
          >
            {advancing ? 'Цикл идёт…' : `Следующий цикл (+${CYCLE_MINUTES} мин)`}
          </button>
        </div>
      </div>
    </header>
  )
}
