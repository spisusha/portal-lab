import { useLab } from '../state/labStore'
import { formatCountdown } from '../domain/types'

/**
 * Итоговая сводка. Стоит первым блоком, потому что Definition of Done
 * требует понять ситуацию за минуту: сначала счётчики, затем прямой ответ
 * на вопрос «с чего начинать».
 */
export function SummaryPanel({
  onSelect,
}: {
  onSelect: (portalId: string) => void
}) {
  const { summary } = useLab()

  return (
    <section className="panel">
      <h2 className="panel__title">Сводка по лаборатории</h2>

      <div className="summary">
        <Stat value={summary.active} label="Открыто" />
        <Stat value={summary.critical} label="Критичных" danger={summary.critical > 0} />
        <Stat value={summary.closed} label="Закрыто" />
        <Stat value={summary.collapsed} label="Схлопнулось" danger={summary.collapsed > 0} />
        <Stat value={summary.creaturesInside} label="Существ внутри" />
      </div>

      {summary.attention.length > 0 && (
        <div className="attention">
          <div className="section__title">Требуют внимания в первую очередь</div>
          {summary.attention.map((item, index) => (
            <div key={item.portal.id} className="attention__item">
              <span className="attention__order">{index + 1}.</span>
              <button
                type="button"
                className="link"
                onClick={() => onSelect(item.portal.id)}
              >
                {item.portal.name}
              </button>
              <span>
                ранг {item.risk.rank} — {item.risk.label}, риск {item.risk.score}
              </span>
              <span className="portal-row__world">
                осталось {formatCountdown(item.portal.minutesToCollapse)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Stat({
  value,
  label,
  danger = false,
}: {
  value: number
  label: string
  danger?: boolean
}) {
  return (
    <div className={`stat${danger ? ' stat--danger' : ''}`}>
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  )
}
