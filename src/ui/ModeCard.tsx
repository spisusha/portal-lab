import { useLab } from '../state/labStore'
import { useLiveClock } from '../state/liveClock'
import { createSeedCode } from '../state/liveSeed'
import type { ScenarioId } from '../domain/types'

/**
 * Что это за режим и чем он отличается от остальных.
 *
 * Блок стоит вплотную под переключателем и меняется вместе с ним. Раньше
 * список выглядел как четыре равноправных уровня сложности, и «Критическая
 * ситуация» читалась как отдельный режим игры, а не как заготовленный
 * пример опасного состояния.
 *
 * Здесь же живёт управление временем живой смены: кнопка «Начать живую
 * смену» до запуска и состояние таймера после. Отдельного окна для этого
 * не заводится — объяснение режима и его запуск это одно и то же место.
 */

interface ModeCopy {
  /** Метка группы: учебный это сценарий или основной режим. */
  label: string
  title: string
  text: string
}

const MODE_COPY: Record<ScenarioId, ModeCopy> = {
  standard: {
    label: 'Учебный сценарий',
    title: 'Штатный режим',
    text:
      'Подготовленная тренировочная смена. Здесь можно разобраться с риском, ' +
      'очередью порталов и доступными действиями без критической ситуации на старте.',
  },
  critical: {
    label: 'Учебный сценарий',
    title: 'Критическая ситуация',
    text:
      'Подготовленный аварийный сценарий. Он показывает портал критического ' +
      'ранга S, ограничения действий и последствия промедления.',
  },
  empty: {
    label: 'Учебный сценарий',
    title: 'Пустая лаборатория',
    text:
      'Демонстрация завершённого состояния: активных порталов нет, очередь ' +
      'пуста, а лаборатория под контролем.',
  },
  live: {
    label: 'Живая смена',
    title: 'Уникальная смена',
    text:
      'Порталы, особенности миров, события и директива сформированы по коду ' +
      'смены. Решения влияют на итоговый счёт, а время после запуска движется ' +
      'автоматически.',
  },
}

export function ModeCard() {
  const { state, dispatch } = useLab()
  const scenario = state.scenario
  const copy = MODE_COPY[scenario]
  const live = scenario === 'live'
  const seed = state.live?.seed ?? null

  const goLive = () => {
    dispatch({ type: 'LOAD_SCENARIO', scenario: 'live', seed: createSeedCode() })
  }

  return (
    <section
      className={`modecard modecard--${live ? 'live' : 'demo'}`}
      aria-label={`Выбранный режим: ${copy.title}`}
    >
      <p className="modecard__label">{copy.label}</p>
      <h2 className="modecard__title">
        {copy.title}
        {live && seed && (
          <>
            {' · '}
            <code className="modecard__seed">{seed}</code>
          </>
        )}
      </h2>
      <p className="modecard__text">{copy.text}</p>

      {live ? <LiveControls /> : (
        <button type="button" className="btn btn--ghost modecard__action" onClick={goLive}>
          Перейти в живую смену
        </button>
      )}
    </section>
  )
}

/**
 * Управление временем живой смены.
 *
 * До запуска — одна кнопка. После — состояние таймера и пауза: отсчёт и
 * «Завершить цикл сейчас» стоят рядом с прогнозом, потому что решение
 * пропустить остаток цикла принимают, глядя на прогноз, а не на кнопку.
 */
function LiveControls() {
  const { state } = useLab()
  const clock = useLiveClock()

  if (state.shiftStatus === 'COMPLETE') return null

  if (!clock.started) {
    return (
      <div className="modecard__controls">
        <button type="button" className="btn btn--primary modecard__action" onClick={clock.start}>
          Начать живую смену
        </button>
      </div>
    )
  }

  return (
    <div className="modecard__controls">
      <p
        className={`modecard__timer${clock.running ? ' modecard__timer--on' : ''}`}
        role="status"
      >
        <span className="modecard__timer-dot" aria-hidden="true" />
        {clock.running
          ? 'Время смены идёт'
          : (clock.pauseReason ?? 'Таймер остановлен.')}
      </p>
      {clock.running ? (
        <button type="button" className="btn modecard__action" onClick={clock.pause}>
          Пауза
        </button>
      ) : clock.autoPaused ? null : (
        <button
          type="button"
          className="btn btn--primary modecard__action"
          onClick={clock.resume}
        >
          Продолжить
        </button>
      )}
    </div>
  )
}
