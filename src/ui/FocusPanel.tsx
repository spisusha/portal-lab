import { useLab } from '../state/labStore'
import { ACTION_LABELS, STATUS_LABELS } from '../domain/types'
import { checkAction } from '../domain/rules'
import { riskHeadline } from '../domain/risk'
import { PortalRing } from './PortalRing'
import { toLabAction } from './portalActions'

/**
 * «Требует решения сейчас» — главный ответ на вопрос «с чего начать».
 *
 * Стоит вторым блоком экрана, сразу под целью смены, и делает за человека
 * ровно одну вещь: выбирает самый опасный портал и объясняет, почему именно
 * его. Сам выбор и формулировка причины живут в domain/focus — здесь только
 * показ и одна кнопка главного действия.
 */
export function FocusPanel({
  onOpenCard,
}: {
  onOpenCard: (portalId: string) => void
}) {
  const { focus, dispatch } = useLab()

  if (!focus) {
    return (
      <section className="focus focus--calm" aria-labelledby="focus-title">
        <h2 className="focus__eyebrow" id="focus-title">
          Требует решения сейчас
        </h2>
        <p className="focus__quiet">
          Открытых порталов нет — решать нечего. Смена спокойна.
        </p>
      </section>
    )
  }

  const { item, reason, recommendation, urgency } = focus
  const { portal, risk } = item
  const action = recommendation.action
  const check = action ? checkAction(portal, action) : null

  return (
    <section
      className={`focus focus--${urgency}`}
      aria-labelledby="focus-title"
    >
      <div className="focus__ring">
        <PortalRing risk={risk} label={`ранг ${risk.rank} — ${risk.label}`} />
      </div>

      <div className="focus__body">
        <h2 className="focus__eyebrow" id="focus-title">
          Требует решения сейчас
        </h2>

        <p className="focus__name">{portal.name}</p>
        <p className="focus__world">
          {portal.world} · {STATUS_LABELS[portal.status]} · риск {risk.score} из 100
        </p>

        {/* Почему выбран именно этот портал — текст приходит из домена. */}
        <p className="focus__reason">{reason}</p>
        <p className="focus__headline">{riskHeadline(risk)}</p>

        <div className="focus__decision">
          <p className="focus__advice">{recommendation.text}</p>

          <div className="focus__buttons">
            {action && check?.allowed ? (
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={() => dispatch(toLabAction(action, portal.id))}
              >
                {ACTION_LABELS[action]}
              </button>
            ) : (
              <span className="focus__no-action">
                {action
                  ? `Действие «${ACTION_LABELS[action]}» сейчас недоступно: ${check?.reason}`
                  : 'Вмешательство не требуется — достаточно наблюдения.'}
              </span>
            )}

            <button
              type="button"
              className="btn"
              onClick={() => onOpenCard(portal.id)}
            >
              Открыть карточку
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
