import { useLab } from '../state/labStore'
import { Drawer } from './Drawer'
import { STATUS_LABELS, formatClock } from '../domain/types'
import { RANK_SCALE, RISK_FORMULA_TEXT } from '../domain/risk'
import { counted } from './plural'

/**
 * Подробности, которые нужны не всем и не сразу: разбор формулы, шкала
 * рангов, история портала и журнал смены.
 *
 * Всё это раньше лежало открытым на экране и создавало ощущение
 * технической панели. Убрано в раскрывающиеся блоки, но не спрятано:
 * заголовки видны, счётчики в них тоже, и любой блок открывается одним
 * нажатием. Журнал остался — но он больше не единственный способ узнать,
 * что изменилось после действия.
 */
export function Archive({ portalId }: { portalId: string | null }) {
  const { portals, state } = useLab()
  const item = portals.find((p) => p.portal.id === portalId)

  return (
    <div className="archive">
      {item && (
        <>
          <Drawer title="Как рассчитан риск" hint={`итог ${item.risk.applicable ? item.risk.score : '—'}`}>
            <p className="formula">{RISK_FORMULA_TEXT}</p>

            {item.risk.applicable ? (
              <>
                <table className="ledger">
                  <tbody>
                    {item.risk.parts.map((part) => (
                      <tr key={part.key}>
                        <th scope="row">{part.title}</th>
                        <td className="ledger__why">{part.explanation}</td>
                        <td className="ledger__math">
                          {part.weight} × {Math.round(part.raw)} ={' '}
                          {part.contribution.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">Итог</th>
                      <td className="ledger__why">
                        ранг {item.risk.rank} — {item.risk.label}
                      </td>
                      <td className="ledger__math">{item.risk.score} из 100</td>
                    </tr>
                  </tfoot>
                </table>

                <div className="scale">
                  <p className="scale__caption">Шкала рангов</p>
                  <ol className="scale__list">
                    {RANK_SCALE.map((step) => (
                      <li
                        key={step.rank}
                        className={`scale__step scale__step--${step.rank}${
                          step.rank === item.risk.rank ? ' scale__step--now' : ''
                        }`}
                      >
                        <span className="scale__rank">{step.rank}</span>
                        <span className="scale__label">{step.label}</span>
                        <span className="scale__range">
                          {step.min}–{step.max}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            ) : (
              <p className="quiet">
                Портал в статусе «{STATUS_LABELS[item.portal.status]}» — риск
                к нему неприменим и в очереди он не учитывается.
              </p>
            )}
          </Drawer>

          <Drawer
            title="История портала"
            hint={counted(item.portal.history.length, 'запись', 'записи', 'записей')}
          >
            <ol className="trail">
              {item.portal.history.map((entry, index) => (
                <li key={index} className="trail__row">
                  <span className="trail__time">
                    {formatClock(entry.atMinutes)}
                  </span>
                  <span className="trail__text">{entry.text}</span>
                </li>
              ))}
            </ol>
          </Drawer>
        </>
      )}

      <Drawer
        title="Журнал смены"
        hint={counted(state.log.length, 'событие', 'события', 'событий')}
      >
        {state.log.length === 0 ? (
          <p className="quiet">Событий пока нет.</p>
        ) : (
          <ol className="trail">
            {state.log.map((entry) => (
              <li key={entry.id} className={`trail__row trail__row--${entry.kind}`}>
                <span className="trail__time">{formatClock(entry.atMinutes)}</span>
                <span className="trail__text">
                  {entry.portalName && (
                    <span className="trail__portal">{entry.portalName}: </span>
                  )}
                  {entry.text}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Drawer>
    </div>
  )
}
