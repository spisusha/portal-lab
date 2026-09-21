/**
 * Рекомендуемое действие для портала.
 *
 * Это подсказка смотрителю, а не автопилот: приложение объясняет, что бы
 * оно сделало и почему, но решение остаётся за человеком. Рекомендация
 * никогда не предлагает запрещённое действие — она сверяется с rules.
 */

import type { Portal, PortalActionKind } from './types'
import { CYCLE_MINUTES, isActive } from './types'
import { computeRisk, isCriticalRank } from './risk'
import { checkAction, MAX_STABILITY } from './rules'

export interface Recommendation {
  action: PortalActionKind | null
  text: string
}

export function recommendAction(portal: Portal): Recommendation {
  if (!isActive(portal)) {
    return {
      action: null,
      text: 'Портал в терминальном статусе — вмешательство не требуется.',
    }
  }

  const risk = computeRisk(portal)

  // 1. Времени не осталось: управляемое закрытие лучше схлопывания.
  if (portal.minutesToCollapse <= CYCLE_MINUTES) {
    return {
      action: 'CLOSE',
      text: `До схлопывания ${portal.minutesToCollapse} мин — это меньше одного цикла. Управляемое закрытие безопаснее неконтролируемого схлопывания.`,
    }
  }

  // 2. Критический ранг: сначала сбить риск, если контур ещё принимает.
  if (isCriticalRank(risk.rank)) {
    if (portal.stability < MAX_STABILITY) {
      return {
        action: 'STABILIZE',
        text: `Ранг ${risk.rank} (${risk.label}). Стабилизация снизит риск и откроет доступ к остальным действиям — при ранге A и S разведка запрещена.`,
      }
    }
    return {
      action: 'CLOSE',
      text: `Ранг ${risk.rank} (${risk.label}), контур стабилизации исчерпан. Остаётся закрыть портал.`,
    }
  }

  // 3. Повышенный риск: снижаем заранее.
  if (risk.rank === 'B' && portal.stability < MAX_STABILITY) {
    return {
      action: 'STABILIZE',
      text: `Ранг ${risk.rank} (${risk.label}) и стабильность ${portal.stability} из 100. Стабилизация удержит портал в безопасной зоне.`,
    }
  }

  // 4. Риск умеренный, но данные о существах не подтверждены — нужна разведка.
  if (!portal.creaturesConfirmed && checkAction(portal, 'SEND_OBSERVER').allowed) {
    return {
      action: 'SEND_OBSERVER',
      text: `Риск ${risk.score} (${risk.label}) позволяет разведку, а число существ внутри не подтверждено. Наблюдатель уточнит данные к следующему циклу.`,
    }
  }

  // 5. Всё спокойно.
  return {
    action: null,
    text: `Риск ${risk.score} (${risk.label}). Портал под контролем, достаточно наблюдения.`,
  }
}
