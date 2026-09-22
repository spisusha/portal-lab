/**
 * Прогноз на один цикл вперёд.
 *
 * Требование интерфейса: человек не должен двигать время вслепую.
 * До нажатия «Следующий цикл» он видит, какой портал станет опаснее,
 * а какой схлопнется. Считается той же функцией `projectPortal`,
 * которой пользуется редьюсер, — обещание и дело совпадают по построению.
 *
 * Модуль ничего не меняет: только читает состояние и возвращает текст.
 */

import type { LabState, Portal, RiskRank } from './types'
import { CYCLE_MINUTES, isActive } from './types'
import { computeRisk } from './risk'
import { counted } from './plural'
import { simulateCycle } from './simulate'
import type { ShiftEvent } from './live/events'

export interface PortalOutlook {
  portal: Portal
  riskBefore: number
  riskAfter: number
  rankBefore: RiskRank
  rankAfter: RiskRank
  /** Портал не доживёт до конца цикла. */
  collapsing: boolean
  /** Существа, которые останутся внутри в момент схлопывания. */
  creaturesLost: number
}

export type ForecastTone = 'critical' | 'warning' | 'calm'

export interface CycleForecast {
  /** Активные порталы, самые тяжёлые последствия сверху. */
  outlooks: PortalOutlook[]
  collapsing: PortalOutlook[]
  /** У кого риск вырастет заметнее всех. */
  worst: PortalOutlook | null
  /** Одна фраза: что случится, если нажать «Следующий цикл» прямо сейчас. */
  headline: string
  tone: ForecastTone
  /**
   * Событие живой смены, назначенное на этот переход. `null` у трёх
   * демонстрационных сценариев и на тихих переходах.
   */
  event: ShiftEvent | null
  /**
   * Обещание события словами. Считается по тому же состоянию и той же
   * функцией, которой событие будет применено, — разойтись им нечем.
   */
  eventText: string | null
}

export function buildForecast(state: LabState): CycleForecast {
  // Весь переход считается один раз и целиком: вместе с событием живой смены
  // и его последствиями. Редьюсер позовёт ровно ту же функцию.
  const simulation = simulateCycle(state)

  const outlooks: PortalOutlook[] = state.portals
    .map((portal, index) => ({ portal, after: simulation.portals[index] }))
    .filter((pair) => isActive(pair.portal))
    .map(({ portal, after }) => {
      const riskBefore = computeRisk(portal)
      const riskAfter = computeRisk({ ...after, status: portal.status })
      const collapsing = after.status === 'COLLAPSED'
      return {
        portal,
        riskBefore: riskBefore.score,
        riskAfter: riskAfter.score,
        rankBefore: riskBefore.rank,
        rankAfter: riskAfter.rank,
        collapsing,
        creaturesLost: collapsing ? after.creaturesInside : 0,
      }
    })
    .sort((a, b) => {
      if (a.collapsing !== b.collapsing) return a.collapsing ? -1 : 1
      return b.riskAfter - a.riskAfter
    })

  const collapsing = outlooks.filter((item) => item.collapsing)
  const rising = outlooks
    .filter((item) => !item.collapsing && item.riskAfter > item.riskBefore)
    .sort((a, b) => b.riskAfter - b.riskBefore - (a.riskAfter - a.riskBefore))
  const worst = rising[0] ?? null

  return {
    outlooks,
    collapsing,
    worst,
    headline: headlineFor(outlooks, collapsing, worst),
    tone: collapsing.length > 0 ? 'critical' : worst ? 'warning' : 'calm',
    event: simulation.event,
    eventText: simulation.announcement,
  }
}

/**
 * Одна фраза прогноза.
 *
 * Пишется так, как её сказал бы дежурный по лаборатории: полным
 * предложением и с числительными в нужной форме. Прежняя версия начиналась
 * с «Никто не схлопнется» — это читалось как ответ на незаданный вопрос,
 * а «сильнее всех просядет» вообще не про состояние портала.
 */
function headlineFor(
  outlooks: PortalOutlook[],
  collapsing: PortalOutlook[],
  worst: PortalOutlook | null,
): string {
  if (outlooks.length === 0) {
    return 'Открытых порталов нет — следующий цикл пройдёт без событий.'
  }

  if (collapsing.length === 1) {
    const one = collapsing[0]
    const tail =
      one.creaturesLost > 0
        ? ` Внутри останется ${counted(one.creaturesLost, 'существо', 'существа', 'существ')}.`
        : ''
    return `Через ${CYCLE_MINUTES} мин схлопнется «${one.portal.name}».${tail}`
  }

  if (collapsing.length > 1) {
    const names = collapsing.map((item) => `«${item.portal.name}»`).join(', ')
    const lost = collapsing.reduce((sum, item) => sum + item.creaturesLost, 0)
    const tail =
      lost > 0
        ? ` Внутри останется ${counted(lost, 'существо', 'существа', 'существ')}.`
        : ''
    return `Через ${CYCLE_MINUTES} мин схлопнется ${counted(collapsing.length, 'портал', 'портала', 'порталов')}: ${names}.${tail}`
  }

  if (worst) {
    return `В следующем цикле ни один портал не схлопнется. Сильнее всего ухудшится состояние «${worst.portal.name}»: риск ${worst.riskBefore} → ${worst.riskAfter}.`
  }

  return `В следующем цикле ни один портал не схлопнется, и показатели не изменятся: все порталы держатся.`
}
