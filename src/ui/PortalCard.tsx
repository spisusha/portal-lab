import { useLab } from '../state/labStore'
import {
  ACTION_LABELS,
  STATUS_LABELS,
  formatClock,
  formatCountdown,
} from '../domain/types'
import { RISK_FORMULA_TEXT, riskHeadline } from '../domain/risk'
import { checkAllActions } from '../domain/rules'
import { recommendAction } from '../domain/recommend'
import { RankBadge } from './RankBadge'
import { WorldScene } from './WorldScene'
import { ACTION_ORDER, toLabAction } from './portalActions'

/**
 * Карточка портала.
 *
 * Порядок блоков подчинён одному правилу: сначала решение, потом арифметика.
 * До редизайна разбор формулы стоял выше кнопок, и до действий приходилось
 * прокручивать пол-экрана. Теперь вычисления живут в свёрнутом блоке
 * «Как рассчитан риск», а сверху — одна человеческая фраза о том, что не так.
 */
export function PortalCard({ portalId }: { portalId: string | null }) {
  const { portals, dispatch } = useLab()
  const item = portals.find((p) => p.portal.id === portalId)

  if (!item) {
    return (
      <section className="panel">
        <h2 className="panel__title">Карточка портала</h2>
        <p className="muted">
          Выберите портал в списке, чтобы увидеть разбор риска, историю
          и доступные действия.
        </p>
      </section>
    )
  }

  const { portal, risk } = item
  const checks = checkAllActions(portal)
  const recommendation = recommendAction(portal)

  return (
    <section className="panel card">
      <div className="card__scene">
        <WorldScene world={portal.world} />
        <div className="card__scene-caption">
          <span className="card__world-name">{portal.world}</span>
          <span className="card__status">{STATUS_LABELS[portal.status]}</span>
        </div>
      </div>

      <div className="card__head">
        <RankBadge risk={risk} />
        <div>
          <h2 className="card__name">{portal.name}</h2>
          <p className="card__headline">{riskHeadline(risk)}</p>
        </div>
      </div>

      <div className="metrics">
        <Metric label="Энергия" value={portal.energy} bar={portal.energy} tone="energy" />
        <Metric
          label="Стабильность"
          value={portal.stability}
          bar={portal.stability}
          tone="stability"
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
        <h3 className="section__title">Действия</h3>
        <p className="card__advice">{recommendation.text}</p>

        <div className="actions">
          {ACTION_ORDER.map((kind) => {
            const check = checks[kind]
            const primary = recommendation.action === kind && check.allowed
            return (
              <button
                key={kind}
                type="button"
                className={`action${primary ? ' action--primary' : ''}`}
                disabled={!check.allowed}
                onClick={() => dispatch(toLabAction(kind, portal.id))}
              >
                <span className="action__label">
                  {ACTION_LABELS[kind]}
                  {primary && <span className="action__tag">рекомендуется</span>}
                </span>
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

      {/* Арифметика спрятана, но никуда не делась: формула остаётся
          объяснимой, просто не мешает принимать решение. */}
      <details className="details">
        <summary className="details__summary">Как рассчитан риск</summary>
        <div className="details__body">
          <p className="formula">{RISK_FORMULA_TEXT}</p>

          {risk.applicable ? (
            <>
              {risk.parts.map((part) => (
                <div key={part.key} className="risk-part">
                  <span>
                    {part.title}
                    <span className="risk-part__explanation">
                      {' '}
                      — {part.explanation}
                    </span>
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
            <p className="muted">
              Портал в статусе «{STATUS_LABELS[portal.status]}» — риск к нему
              неприменим и в сводке он не учитывается.
            </p>
          )}
        </div>
      </details>

      <div className="section">
        <h3 className="section__title">История портала</h3>
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
  tone,
}: {
  label: string
  value: string | number
  bar?: number
  hint?: string
  tone?: 'energy' | 'stability'
}) {
  return (
    <div className="metric">
      <div className="metric__label">{label}</div>
      <div className="metric__value">{value}</div>
      {hint && <div className="metric__hint">{hint}</div>}
      {bar !== undefined && (
        <div className="bar">
          <div
            className={`bar__fill${tone ? ` bar__fill--${tone}` : ''}`}
            style={{ width: `${bar}%` }}
          />
        </div>
      )}
    </div>
  )
}
