import { useLab } from '../state/labStore'
import { formatClock } from '../domain/types'

/**
 * Журнал событий: что произошло, с каким порталом и когда.
 * Отклонённые действия тоже попадают сюда — по ним видно, что ограничения
 * действительно сработали, а не просто спрятали кнопку.
 */
export function EventLog() {
  const { state } = useLab()

  return (
    <section className="panel">
      <h2 className="panel__title">Журнал событий — {state.log.length}</h2>
      {state.log.length === 0 ? (
        <p className="portal-row__world">Событий пока нет.</p>
      ) : (
        <div className="log">
          {state.log.map((entry) => (
            <div key={entry.id} className={`log__row log__row--${entry.kind}`}>
              <span className="log__time">{formatClock(entry.atMinutes)}</span>
              <span className="log__text">
                {entry.portalName && (
                  <span className="log__portal">[{entry.portalName}] </span>
                )}
                {entry.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
