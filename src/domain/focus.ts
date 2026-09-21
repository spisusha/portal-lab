/**
 * «Что требует решения прямо сейчас».
 *
 * Самая важная подсказка во всём приложении: человек, открывший смену
 * впервые, не должен сам решать, с какой строки списка начинать.
 *
 * Модуль живёт в домене, а не в компоненте, по той же причине, что и правила:
 * выбор портала опирается на риск и на пороги рангов, а формулировка причины —
 * на сравнение с остальными порталами. Компонент только показывает результат.
 */

import type { LabState } from './types'
import { CYCLE_MINUTES, formatCountdown, isActive } from './types'
import { computeRisk, isCriticalRank } from './risk'
import type { PortalWithRisk } from './summary'
import { recommendAction, type Recommendation } from './recommend'

/** Насколько срочна ситуация — задаёт тон блока в интерфейсе. */
export type Urgency = 'critical' | 'warning' | 'calm'

export interface FocusSituation {
  item: PortalWithRisk
  /** Почему выбран именно этот портал — человеческим языком. */
  reason: string
  /** Что делать, с объяснением. Берётся из recommend, не дублируется. */
  recommendation: Recommendation
  urgency: Urgency
  /** Сколько всего активных порталов — нужно для формулировки причины. */
  activeCount: number
}

/**
 * Порталов в смене нет или все в терминальном статусе — решать нечего.
 * Это нормальное состояние, а не ошибка: интерфейс показывает «смена спокойна».
 */
export function buildFocus(state: LabState): FocusSituation | null {
  const active: PortalWithRisk[] = state.portals
    .filter(isActive)
    .map((portal) => ({ portal, risk: computeRisk(portal) }))

  if (active.length === 0) return null

  // Тот же порядок, что и в сводке «требуют внимания»: сначала риск,
  // при равном риске — у кого меньше времени.
  const sorted = [...active].sort((a, b) => {
    if (b.risk.score !== a.risk.score) return b.risk.score - a.risk.score
    return a.portal.minutesToCollapse - b.portal.minutesToCollapse
  })

  const item = sorted[0]
  const runnerUp = sorted[1]

  return {
    item,
    reason: buildReason(item, runnerUp, active.length),
    recommendation: recommendAction(item.portal),
    urgency: urgencyFor(item),
    activeCount: active.length,
  }
}

function urgencyFor(item: PortalWithRisk): Urgency {
  if (isCriticalRank(item.risk.rank)) return 'critical'
  if (item.portal.minutesToCollapse <= CYCLE_MINUTES) return 'critical'
  if (item.risk.rank === 'B') return 'warning'
  return 'calm'
}

/**
 * Причина выбора. Складывается из двух частей: чем этот портал хуже
 * остальных и насколько поджимает время. Обе части — сравнительные,
 * потому что «риск 88» само по себе человеку ни о чём не говорит.
 */
function buildReason(
  item: PortalWithRisk,
  runnerUp: PortalWithRisk | undefined,
  activeCount: number,
): string {
  const { portal, risk } = item

  const head =
    activeCount === 1
      ? 'Это единственный открытый портал смены.'
      : runnerUp && runnerUp.risk.score < risk.score
        ? `Самый опасный из ${activeCount} открытых: риск ${risk.score} против ${runnerUp.risk.score} у следующего.`
        : `Один из ${activeCount} открытых порталов с наивысшим риском ${risk.score}.`

  if (portal.minutesToCollapse <= CYCLE_MINUTES) {
    return `${head} До схлопывания ${formatCountdown(portal.minutesToCollapse)} — меньше одного цикла наблюдения.`
  }

  if (isCriticalRank(risk.rank)) {
    return `${head} Ранг ${risk.rank} — при нём разведка запрещена регламентом.`
  }

  return `${head} До схлопывания ${formatCountdown(portal.minutesToCollapse)}.`
}
