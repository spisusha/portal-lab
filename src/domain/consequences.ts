/**
 * Что произойдёт, если нажать эту кнопку.
 *
 * Четыре действия смотрителя внешне похожи, и по названию не видно,
 * чем «отправить наблюдателя» отличается от «пометить под вопросом».
 * Поэтому у каждой кнопки есть строка последствия — короткая, конкретная
 * и, где возможно, с числами.
 *
 * Числа берутся не из головы: стабилизацию считает та же `applyStabilize`,
 * которую применит редьюсер. Обещание «печать 30 → 55» не может разойтись
 * с тем, что случится после нажатия.
 */

import type { Portal, PortalActionKind } from './types'
import { isActive } from './types'
import { computeRisk } from './risk'
import { applyStabilize, MAX_STABILITY } from './rules'

export function actionOutcome(
  portal: Portal,
  kind: PortalActionKind,
): string {
  if (!isActive(portal)) {
    return 'Портал в терминальном статусе — действие ничего не изменит.'
  }

  switch (kind) {
    case 'STABILIZE': {
      if (portal.stability >= MAX_STABILITY) {
        return 'Контур уже на пределе — поднимать нечего.'
      }
      const after = applyStabilize(portal)
      const riskBefore = computeRisk(portal).score
      const riskAfter = computeRisk(after).score
      return `Стабильность ${portal.stability} → ${after.stability}, энергия ${portal.energy} → ${after.energy}. Риск ${riskBefore} → ${riskAfter}.`
    }

    case 'SEND_OBSERVER': {
      if (portal.observerInside) {
        return 'Наблюдатель уже внутри — отчёт придёт в конце цикла.'
      }
      return portal.creaturesConfirmed
        ? 'Наблюдатель войдёт внутрь и к концу цикла перепроверит обстановку. Показатели портала не изменятся.'
        : `Наблюдатель войдёт внутрь и к концу цикла заменит оценку приборов (≈${portal.creaturesInside}) точным числом существ. Показатели портала не изменятся.`
    }

    case 'MARK_QUESTIONED': {
      return 'Портал получит метку «под вопросом» — напоминание, что решение отложено. Риск и показатели не изменятся.'
    }

    case 'CLOSE': {
      const parts = ['Портал закроется навсегда и уйдёт из очереди']
      if (portal.creaturesInside > 0) {
        const count = portal.creaturesConfirmed
          ? `${portal.creaturesInside}`
          : `около ${portal.creaturesInside}`
        parts.push(`внутри останется существ: ${count}`)
      }
      if (portal.observerInside) {
        parts.push('наблюдателя придётся выводить в аварийном режиме')
      }
      return `${parts.join('; ')}.`
    }
  }
}
