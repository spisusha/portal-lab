import { useLab } from '../state/labStore'
import { formatCountdown } from '../domain/types'
import { RankLegend } from './RankLegend'

/**
 * Краткая сводка по смене.
 *
 * После редизайна стоит третьим блоком: самый опасный портал уже разобран
 * выше, в «Требует решения сейчас». Поэтому здесь из очереди внимания
 * показываются только следующие за ним — дублировать первую строку незачем.
 */
export function SummaryPanel({
  onSelect,
}: {
  onSelect: (portalId: string) => void
}) {
  const { summary, focus } = useLab()
  const focusedId = focus?.item.portal.id ?? null
  const queue = summary.attention.filter((item) => item.portal.id !== focusedId)

  return (
    <section className="panel">
      <h2 className="panel__title">Сводка по смене</h2>

      <div className="summary">
        <Stat value={summary.active} label="Открыто" />
        <Stat
          value={summary.critical}
          label="Критичных"
          tone={summary.critical > 0 ? 'danger' : undefined}
        />
        <Stat value={summary.closed} label="Закрыто" />
        <Stat
          value={summary.collapsed}
          label="Схлопнулось"
          tone={summary.collapsed > 0 ? 'danger' : undefined}
        />
        <Stat value={summary.creaturesInside} label="Существ внутри" />
      </div>

      {queue.length > 0 && (
        <div className="attention">
          <h3 className="section__title">Следующие в очереди</h3>
          <ul className="attention__list">
            {queue.map((item) => (
              <li key={item.portal.id} className="attention__item">
                <button
                  type="button"
                  className="link"
                  onClick={() => onSelect(item.portal.id)}
                >
                  {item.portal.name}
                </button>
                <span>
                  ранг {item.risk.rank} — {item.risk.label}, риск{' '}
                  {item.risk.score}
                </span>
                <span className="muted">
                  осталось {formatCountdown(item.portal.minutesToCollapse)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <RankLegend />
    </section>
  )
}

function Stat({
  value,
  label,
  tone,
}: {
  value: number
  label: string
  tone?: 'danger'
}) {
  return (
    <div className={`stat${tone ? ` stat--${tone}` : ''}`}>
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  )
}
