import { useLab } from '../state/labStore'
import {
  ACTION_LABELS,
  STATUS_LABELS,
  formatClock,
  formatCountdown,
  type LabAction,
  type PortalActionKind,
} from '../domain/types'
import { RISK_FORMULA_TEXT } from '../domain/risk'
import { checkAllActions } from '../domain/rules'
import { recommendAction } from '../domain/recommend'
import { RankBadge } from './RankBadge'

const ACTION_ORDER: PortalActionKind[] = [
  'STABILIZE',
  'SEND_OBSERVER',
  'MARK_QUESTIONED',
  'CLOSE',
]

/** Действие интерфейса → действие домена. */
function toLabAction(kind: PortalActionKind, portalId: string): LabAction {
  switch (kind) {
    case 'STABILIZE':
      return { type: 'STABILIZE', portalId }
    case 'SEND_OBSERVER':
      return { type: 'SEND_OBSERVER', portalId }
    case 'MARK_QUESTIONED':
      return { type: 'MARK_QUESTIONED', portalId }
    case 'CLOSE':
      return { type: 'CLOSE', portalId }
  }
}

/**
 * Карточка портала: подробности, разбор риска, история и действия.
 *
 * Разбор риска показан слагаемыми, а не одним числом — это и есть
 * «формула объяснена» из ТЗ.
 */
export function PortalCard({ portalId }: { portalId: string | null }) {
  const { portals, dispatch } = useLab()
  const item = portals.find((p) => p.portal.id === portalId)

  if (!item) {
    return (
      <section className="panel">
        <h2 className="panel__title">Карточка портала</h2>
        <p className="portal-row__world">
          Выберите портал в списке слева, чтобы увидеть разбор риска, историю
          и доступные действия.
        </p>
      </section>
    )
  }

  const { portal, risk } = item
  const checks = checkAllActions(portal)
  const recommendation = recommendAction(portal)

  return (
    <section className="panel">
      <h2 className="panel__title">Карточка портала</h2>

      <div className="card__head">
        <RankBadge risk={risk} />
        <div>
          <h3 className="card__name">{portal.name}</h3>
          <div className="card__world">
            {portal.world} · статус: {STATUS_LABELS[portal.status]}
          </div>
        </div>
      </div>

      <div className="metrics">
        <Metric label="Энергия" value={portal.energy} bar={portal.energy} />
        <Metric
          label="Стабильность"
          value={portal.stability}
          bar={portal.stability}
        />
        <Metric
          label="До схлопывания"
          value={formatCountdown(portal.minutesToCollapse)}
        />
        <Metric
          label="Существ внутри"
          value={`${portal.creaturesConfirmed ? '' : '≈'}${portal.creaturesInside}`}
          hint={portal.creaturesConfirmed ? 'подтверждено' : 'оценка приборов'}
        />
      </div>

      <div className="section">
        <div className="section__title">Из чего складывается риск</div>
        <div className="formula">{RISK_FORMULA_TEXT}</div>

        {risk.applicable ? (
          <>
            {risk.parts.map((part) => (
              <div key={part.key} className="risk-part">
                <span>
                  {part.title}
                  <span className="risk-part__explanation"> — {part.explanation}</span>
                </span>
                <span className="risk-part__value">
                  {part.weight} × {Math.round(part.raw)} ={' '}
                  {part.contribution.toFixed(1)}
                </span>
              </div>
            ))}
            <div className="risk-total">
              <span>Итоговый риск</span>
              <span>
                {risk.score} из 100 — ранг {risk.rank} ({risk.label})
              </span>
            </div>
          </>
        ) : (
          <p className="portal-row__world">
            Портал в статусе «{STATUS_LABELS[portal.status]}» — риск к нему
            неприменим и в сводке он не учитывается.
          </p>
        )}
      </div>

      <div className="section">
        <div className="section__title">Рекомендуемое действие</div>
        <div className="recommendation">
          <div className="recommendation__action">
            {recommendation.action
              ? ACTION_LABELS[recommendation.action]
              : 'Вмешательство не требуется'}
          </div>
          {recommendation.text}
        </div>
      </div>

      <div className="section">
        <div className="section__title">Действия</div>
        <div className="actions">
          {ACTION_ORDER.map((kind) => {
            const check = checks[kind]
            return (
              <button
                key={kind}
                type="button"
                className="action"
                disabled={!check.allowed}
                onClick={() => dispatch(toLabAction(kind, portal.id))}
              >
                <span className="action__label">{ACTION_LABELS[kind]}</span>
                {!check.allowed && (
                  <span className="action__hint">Недоступно: {check.reason}</span>
                )}
                {check.allowed && check.requiresConfirm && (
                  <span className="action__hint action__hint--info">
                    Потребуется подтверждение.
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="section">
        <div className="section__title">История изменений</div>
        {portal.history.map((entry, index) => (
          <div key={index} className="log__row">
            <span className="log__time">{formatClock(entry.atMinutes)}</span>
            <span className="log__text">{entry.text}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function Metric({
  label,
  value,
  bar,
  hint,
}: {
  label: string
  value: string | number
  bar?: number
  hint?: string
}) {
  return (
    <div className="metric">
      <div className="metric__label">{label}</div>
      <div className="metric__value">{value}</div>
      {hint && <div className="risk-part__explanation">{hint}</div>}
      {bar !== undefined && (
        <div className="bar">
          <div className="bar__fill" style={{ width: `${bar}%` }} />
        </div>
      )}
    </div>
  )
}
