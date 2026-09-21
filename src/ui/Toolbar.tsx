import { useLab } from '../state/labStore'
import { SCENARIO_TITLES } from '../domain/reducer'
import { CYCLE_MINUTES, type ScenarioId } from '../domain/types'

const SCENARIOS: ScenarioId[] = ['standard', 'critical', 'empty']

const SCENARIO_HINTS: Record<ScenarioId, string> = {
  standard: 'Обычная смена: ранги от E до A',
  critical: 'Есть портал ранга S и портал, который схлопнется за один цикл',
  empty: 'Пустой список порталов',
}

/**
 * Панель управления сменой.
 *
 * Время двигается не само, а по кнопке «Следующий цикл». Это сделано
 * намеренно: проверяющий управляет темпом и ничего не схлопывается, пока
 * он читает карточку. Побочная польза — поведение детерминировано и
 * покрывается тестами.
 */
export function Toolbar() {
  const { state, dispatch } = useLab()

  return (
    <section className="panel">
      <div className="toolbar">
        <div className="scenarios">
          <span className="section__title">Демо-сценарии:</span>
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario}
              type="button"
              title={SCENARIO_HINTS[scenario]}
              className={`chip${state.scenario === scenario ? ' chip--active' : ''}`}
              onClick={() => dispatch({ type: 'LOAD_SCENARIO', scenario })}
            >
              {SCENARIO_TITLES[scenario]}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn btn--primary"
          onClick={() => dispatch({ type: 'NEXT_CYCLE' })}
        >
          Следующий цикл (+{CYCLE_MINUTES} мин)
        </button>
      </div>
    </section>
  )
}
