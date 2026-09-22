import { formatClock } from '../domain/types'
import { useLab } from '../state/labStore'

/** Финальный экран демонстрационной смены: результат важнее красивой фразы. */
export function ShiftComplete({
  showLog,
  onShowLog,
  onRestart,
}: {
  showLog: boolean
  onShowLog: () => void
  onRestart: () => void
}) {
  const { shiftSummary, state } = useLab()
  const outcomeLabels = {
    excellent: 'Отличная смена',
    controlled: 'Смена под контролем',
    losses: 'Смена с потерями',
    empty: 'Лаборатория пуста',
  } as const
  const empty = shiftSummary.outcome === 'empty'

  const metrics = [
    ['Продолжительность', `${shiftSummary.durationMinutes} мин (${formatClock(shiftSummary.durationMinutes)})`],
    ['Выполнено циклов', `${shiftSummary.cycles} из 6`],
    ['Порталов в начале', shiftSummary.startedPortals],
    ['Осталось открытыми', shiftSummary.remainingOpen],
    ['Стабилизировано хотя бы раз', shiftSummary.stabilized],
    ['Закрыто', shiftSummary.closed],
    ['Схлопнулось', shiftSummary.collapsed],
    ['Осталось критическими', shiftSummary.critical],
    ['Под вопросом', shiftSummary.questioned],
    ['Наблюдателей вернулось', shiftSummary.observersReturned],
    ['Существ в безопасных порталах', shiftSummary.safeCreatures],
    ['Существ под угрозой', shiftSummary.threatenedCreatures],
    ['Существ потеряно', shiftSummary.lostCreatures],
    ['Принято решений', shiftSummary.decisions],
  ] as const

  return (
    <section className="complete" aria-labelledby="complete-title">
      <div className={`complete__mark complete__mark--${shiftSummary.outcome}`} aria-hidden="true" />
      <p className="complete__eyebrow">Итог работы смотрителя · {state.scenario === 'empty' ? 'досрочно' : 'демо-режим'}</p>
      <h2 id="complete-title" className="complete__title">
        {empty ? 'Лаборатория пуста' : 'Смена завершена'}
      </h2>
      {!empty && (
        <h3 className="complete__outcome">
          {outcomeLabels[shiftSummary.outcome]}
        </h3>
      )}
      <p className="complete__explanation">{shiftSummary.explanation}</p>
      <p className="complete__note">
        Демонстрационная смена ограничена шестью циклами по 15 минут — это короткий сценарий для проверки решений, а не восьмичасовая рабочая смена.
      </p>

      <dl className="complete__metrics">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="complete__actions">
        <button type="button" className="btn" onClick={onShowLog} disabled={showLog}>
          {showLog ? 'Журнал смены открыт' : 'Посмотреть журнал смены'}
        </button>
        <button type="button" className="btn btn--primary" onClick={onRestart}>
          Начать смену заново
        </button>
      </div>
    </section>
  )
}
