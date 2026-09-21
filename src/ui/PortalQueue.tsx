import { useLab } from '../state/labStore'
import { STATUS_LABELS, currentCycle, formatClock, formatCountdown, isActive } from '../domain/types'
import type { PortalWithRisk } from '../domain/summary'
import { WorldCrest } from './WorldScene'

/**
 * Очередь порталов — рабочий список смены.
 *
 * Сортировка не по номеру врат, а по риску: сверху то, что решать первым.
 * Схлопнувшиеся и закрытые уходят в конец — они уже не требуют решения.
 *
 * Строка нарочно не похожа на строку таблицы. Слева стоит «корешок»,
 * залитый по высоте пропорционально риску: очередь читается как
 * стеллаж с разной степенью заполнения, а порядок опасности виден
 * силуэтом, без чтения цифр.
 */
export function PortalQueue({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (portalId: string) => void
}) {
  const { portals, dispatch, state } = useLab()

  const activePortals = portals.filter((item) => isActive(item.portal))

  if (activePortals.length === 0) {
    return (
      <section className="queue" aria-labelledby="queue-title">
        <h2 className="queue__title" id="queue-title">
          Очередь порталов — 0
        </h2>
        <div className="queue__empty">
          <p className="queue__empty-title">Очередь пуста</p>
          <p>
            Ни одних врат не зарегистрировано. Приборы молчат — за смену можно
            не беспокоиться.
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

  const ordered = [...activePortals].sort(byUrgency)
  const activeCount = activePortals.length

  return (
    <section className="queue" aria-labelledby="queue-title">
      <h2 className="queue__title" id="queue-title">
        Очередь порталов — {activeCount}
      </h2>
      <p className="queue__hint">
        {activeCount > 0
          ? 'Открытые и помеченные «под вопросом» порталы. Самые опасные сверху.'
          : 'Активных порталов не осталось — все врата в терминальном статусе.'}
      </p>

      <ol className="queue__list">
        {ordered.map((item, index) => (
          <li key={item.portal.id}>
            <Slot
              item={item}
              place={index + 1}
              selected={item.portal.id === selectedId}
              onSelect={onSelect}
              cycle={currentCycle(state)}
            />
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Сначала активные по убыванию риска; при равном риске — у кого меньше времени. */
function byUrgency(a: PortalWithRisk, b: PortalWithRisk): number {
  const aLive = isActive(a.portal)
  const bLive = isActive(b.portal)
  if (aLive !== bLive) return aLive ? -1 : 1
  if (b.risk.score !== a.risk.score) return b.risk.score - a.risk.score
  return a.portal.minutesToCollapse - b.portal.minutesToCollapse
}

function Slot({
  item,
  place,
  selected,
  onSelect,
  cycle,
}: {
  item: PortalWithRisk
  place: number
  selected: boolean
  onSelect: (portalId: string) => void
  cycle: number
}) {
  const { portal, risk } = item
  const terminal = !isActive(portal)
  const critical = risk.applicable && (risk.rank === 'A' || risk.rank === 'S')

  const label = risk.applicable
    ? `${portal.name}. Ранг ${risk.rank}, риск ${risk.score} из 100. ${STATUS_LABELS[portal.status]}.`
    : `${portal.name}. ${STATUS_LABELS[portal.status]}.`

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      className={[
        'slot',
        `slot--rank-${risk.applicable ? risk.rank : 'off'}`,
        selected ? 'slot--open' : '',
        terminal ? 'slot--terminal' : '',
        critical ? 'slot--critical' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onSelect(portal.id)}
    >
      {/* Корешок: залит по высоте пропорционально риску. */}
      <span
        className="slot__spine"
        aria-hidden="true"
        style={{ ['--fill' as string]: `${risk.applicable ? risk.score : 0}%` }}
      />

      <span className="slot__mark" aria-hidden="true">
        <WorldCrest world={portal.world} />
        <span className="slot__rank">{risk.applicable ? risk.rank : '—'}</span>
      </span>

      <span className="slot__text">
        <span className="slot__name">{portal.name}</span>
        <span className="slot__meta">
          {portal.world}
          {terminal ? (
            <> · {STATUS_LABELS[portal.status]}</>
          ) : (
            <> · {formatCountdown(portal.minutesToCollapse)} до схлопывания</>
          )}
        </span>
        {critical && !terminal && (
          <span className="slot__flag">требует решения</span>
        )}
        {portal.observerInside && (
          <span className="slot__flag slot__flag--calm">наблюдатель внутри</span>
        )}
        {portal.status === 'QUESTIONED' && (
          <span className="slot__flag slot__flag--calm">под вопросом</span>
        )}
        {portal.decisionCycle === cycle && portal.decisionAtMinutes !== null && portal.decisionAtMinutes !== undefined && (
          <span className="slot__flag slot__flag--calm">
            решение принято · {formatClock(portal.decisionAtMinutes)}
          </span>
        )}
      </span>

      <span className="slot__score" aria-hidden="true">
        <span className="slot__score-value">
          {risk.applicable ? risk.score : '—'}
        </span>
        <span className="slot__place">№{place}</span>
      </span>
    </button>
  )
}
