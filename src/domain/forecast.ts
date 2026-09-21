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
import { projectPortal } from './cycle'

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
}

export function buildForecast(state: LabState): CycleForecast {
  const outlooks: PortalOutlook[] = state.portals
    .filter(isActive)
    .map((portal) => {
      const after = projectPortal(portal)
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
  }
}

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
        ? ` Внутри останется существ: ${one.creaturesLost}.`
        : ''
    return `Через ${CYCLE_MINUTES} мин схлопнется «${one.portal.name}».${tail}`
  }

  if (collapsing.length > 1) {
    const names = collapsing.map((item) => `«${item.portal.name}»`).join(', ')
    return `Через ${CYCLE_MINUTES} мин схлопнется порталов: ${collapsing.length} — ${names}.`
  }

  if (worst) {
    return `Никто не схлопнется. Сильнее всех просядет «${worst.portal.name}»: риск ${worst.riskBefore} → ${worst.riskAfter}.`
  }

  return `Через ${CYCLE_MINUTES} мин ничего не изменится: все порталы держатся.`
}
