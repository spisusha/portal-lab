import { useLab } from '../state/labStore'
import { ACTION_LABELS } from '../domain/types'
import { currentCycle } from '../domain/types'
import { checkAllActions } from '../domain/rules'
import { recommendAction } from '../domain/recommend'
import { actionOutcome } from '../domain/consequences'
import { ActionGlyph } from './ActionGlyph'
import { ACTION_ORDER, toLabAction } from './portalActions'

/**
 * Панель решения: четыре действия и их последствия.
 *
 * Порядок кнопок жёстко фиксирован — от мягкого вмешательства
 * к необратимому, закрытие всегда последним. Рекомендованное действие
 * не всплывает наверх: переставлять кнопки под состояние значит
 * заставлять человека каждый раз искать заново, и однажды он промахнётся
 * по «Закрыть портал».
 *
 * Под каждым названием стоит строка последствия из domain/consequences —
 * что именно изменится, с числами там, где числа известны. Запрет
 * написан на самой кнопке до нажатия, а не всплывает после.
 */
export function DecisionBench({
  portalId,
  onAct,
}: {
  portalId: string | null
  /** Закрепить портал в камере: после действия очередь пересортируется. */
  onAct: (portalId: string) => void
}) {
  const { portals, dispatch, state } = useLab()
  const item = portals.find((p) => p.portal.id === portalId)

  if (!item) return null

  const { portal } = item
  const checks = checkAllActions(portal, currentCycle(state))
  const recommendation = recommendAction(portal)
  const decisionTaken = portal.decisionCycle === currentCycle(state)

  return (
    <section className="bench" aria-labelledby="bench-title" data-tour="bench">
      <h2 className="bench__title" id="bench-title">
        Решение по порталу «{portal.name}»
      </h2>
      {decisionTaken && (
        <p className="bench__notice">
          Решение по этому порталу уже принято в текущем цикле. Перейдите к следующему порталу или запустите следующий цикл.
        </p>
      )}

      <div className="bench__plates">
        {ACTION_ORDER.map((kind) => {
          const check = checks[kind]
          const advised = recommendation.action === kind && check.allowed
          return (
            <button
              key={kind}
              type="button"
              className={[
                'plate',
                advised ? 'plate--advised' : '',
                check.allowed ? '' : 'plate--blocked',
                kind === 'CLOSE' ? 'plate--grave' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={!check.allowed || state.shiftStatus === 'COMPLETE'}
              onClick={() => {
                onAct(portal.id)
                dispatch(toLabAction(kind, portal.id))
              }}
            >
              <ActionGlyph kind={kind} />

              <span className="plate__body">
                <span className="plate__name">
                  {ACTION_LABELS[kind]}
                  {advised && <span className="plate__tag">рекомендуется</span>}
                </span>

                <span className="plate__outcome">
                  {state.shiftStatus === 'COMPLETE'
                    ? 'Смена завершена. Действия больше недоступны.'
                    : check.allowed
                    ? actionOutcome(portal, kind)
                    : check.reason}
                </span>

                {check.allowed && check.requiresConfirm && (
                  <span className="plate__guard">
                    Спросим подтверждение перед закрытием.
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
