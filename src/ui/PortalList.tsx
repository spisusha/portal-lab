import { useLab } from '../state/labStore'
import { STATUS_LABELS, formatCountdown, isActive } from '../domain/types'
import type { PortalWithRisk } from '../domain/summary'
import { RankBadge } from './RankBadge'
import { WorldCrest } from './WorldScene'

/**
 * Список порталов. Показывает все поля, которые требует ТЗ: название,
 * мир назначения, энергию, стабильность, время до схлопывания, число существ
 * и статус — плюс рассчитанный ранг риска.
 *
 * Знак мира слева нужен не для красоты: девять миров различаются силуэтом
 * быстрее, чем чтением названия.
 */
export function PortalList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (portalId: string) => void
}) {
  const { portals, dispatch } = useLab()

  if (portals.length === 0) {
    return (
      <section className="panel">
        <h2 className="panel__title">Порталы</h2>
        <div className="empty">
          <div className="empty__title">В лаборатории нет активных порталов</div>
          <p>
            Список пуст: наблюдать не за чем. Так выглядит смена, когда все врата
            закрыты — или пока новые ещё не открылись.
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() =>
              dispatch({ type: 'LOAD_SCENARIO', scenario: 'standard' })
            }
          >
            Загрузить штатную смену
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <h2 className="panel__title">Порталы — {portals.length}</h2>
      <ul className="portal-list">
        {portals.map((item) => (
          <li key={item.portal.id}>
            <PortalRow
              item={item}
              selected={item.portal.id === selectedId}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

function PortalRow({
  item,
  selected,
  onSelect,
}: {
  item: PortalWithRisk
  selected: boolean
  onSelect: (portalId: string) => void
}) {
  const { portal, risk } = item
  const terminal = !isActive(portal)
  const rankColor = risk.applicable
    ? `var(--rank-${risk.rank.toLowerCase()})`
    : 'var(--line)'

  return (
    <button
      type="button"
      aria-pressed={selected}
      className={[
        'portal-row',
        selected ? 'portal-row--selected' : '',
        terminal ? 'portal-row--terminal' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ borderLeftColor: rankColor }}
      onClick={() => onSelect(portal.id)}
    >
      <span className="portal-row__art">
        <WorldCrest world={portal.world} />
        <RankBadge risk={risk} />
      </span>

      <span className="portal-row__main">
        <span className="portal-row__name">{portal.name}</span>
        <span className="portal-row__world"> · {portal.world}</span>
        <span className="portal-row__metrics">
          <span>энергия {portal.energy}</span>
          <span>стабильность {portal.stability}</span>
          <span>до схлопывания {formatCountdown(portal.minutesToCollapse)}</span>
          <span>
            существ {portal.creaturesConfirmed ? '' : '≈'}
            {portal.creaturesInside}
          </span>
          {portal.observerInside && <span>наблюдатель внутри</span>}
        </span>
      </span>

      <span className="portal-row__status">
        <span className="portal-row__state">{STATUS_LABELS[portal.status]}</span>
        <span className="portal-row__score">
          {risk.applicable ? `риск ${risk.score}` : '—'}
        </span>
      </span>
    </button>
  )
}
