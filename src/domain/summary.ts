/**
 * Итоговая сводка по лаборатории — то, что смотритель видит первым.
 *
 * Задача сводки: за несколько секунд ответить на вопросы «всё ли под
 * контролем» и «с чего начинать». Поэтому кроме счётчиков она возвращает
 * список «требуют внимания» — активные порталы, отсортированные по риску.
 */

import type { LabState, Portal } from './types'
import { isActive } from './types'
import type { RiskBreakdown } from './risk'
import { computeRisk, isCriticalRank } from './risk'

export interface PortalWithRisk {
  portal: Portal
  risk: RiskBreakdown
}

export interface LabSummary {
  /** Всего порталов в лаборатории. */
  total: number
  /** Активные: открытые плюс помеченные «под вопросом». */
  active: number
  open: number
  questioned: number
  closed: number
  collapsed: number
  /** Активные порталы ранга A или S. */
  critical: number
  /** Существа, оставшиеся внутри активных порталов. */
  creaturesInside: number
  /** Наблюдатели, находящиеся внутри порталов прямо сейчас. */
  observersInside: number
  /** Активные порталы по убыванию риска — чем заняться в первую очередь. */
  attention: PortalWithRisk[]
}

/** Сколько порталов показывать в блоке «требуют внимания». */
export const ATTENTION_LIMIT = 3

export function buildSummary(state: LabState): LabSummary {
  const items: PortalWithRisk[] = state.portals.map((portal) => ({
    portal,
    risk: computeRisk(portal),
  }))

  const activeOnes = items.filter((item) => isActive(item.portal))

  const attention = [...activeOnes]
    .sort((a, b) => {
      if (b.risk.score !== a.risk.score) return b.risk.score - a.risk.score
      // При равном риске первым идёт тот, у кого меньше времени.
      return a.portal.minutesToCollapse - b.portal.minutesToCollapse
    })
    .slice(0, ATTENTION_LIMIT)

  return {
    total: state.portals.length,
    active: activeOnes.length,
    open: state.portals.filter((p) => p.status === 'OPEN').length,
    questioned: state.portals.filter((p) => p.status === 'QUESTIONED').length,
    closed: state.portals.filter((p) => p.status === 'CLOSED').length,
    collapsed: state.portals.filter((p) => p.status === 'COLLAPSED').length,
    critical: activeOnes.filter((item) => isCriticalRank(item.risk.rank)).length,
    creaturesInside: activeOnes.reduce(
      (sum, item) => sum + item.portal.creaturesInside,
      0,
    ),
    observersInside: activeOnes.filter((item) => item.portal.observerInside)
      .length,
    attention,
  }
}

/** Порталы со ссылкой на риск — основа для таблицы в интерфейсе. */
export function withRisk(portals: Portal[]): PortalWithRisk[] {
  return portals.map((portal) => ({ portal, risk: computeRisk(portal) }))
}
