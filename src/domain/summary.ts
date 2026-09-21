/**
 * Итоговая сводка по лаборатории — то, что смотритель видит первым.
 *
 * Задача сводки: за несколько секунд ответить на вопросы «всё ли под
 * контролем» и «с чего начинать». Поэтому кроме счётчиков она возвращает
 * список «требуют внимания» — активные порталы, отсортированные по риску.
 */

import type { LabState, Portal } from './types'
import { currentCycle, isActive } from './types'
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
  /** Активные существа в безопасных рангах B и ниже. */
  safeCreatures: number
  /** Активные существа в опасных рангах A и S. */
  threatenedCreatures: number
  /** Существа, потерянные при терминальном исходе портала. */
  lostCreatures: number
  /** Порталы, стабилизированные хотя бы раз. */
  stabilized: number
  /** Принятые основные решения. */
  decisions: number
  /** Наблюдатели, вернувшиеся с отчётом. */
  observerReturns: number
  /** Активные порталы, по которым решение ещё не принято в текущем цикле. */
  unresolved: number
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
  const safeCreatures = activeOnes
    .filter((item) => item.risk.rank !== 'A' && item.risk.rank !== 'S')
    .reduce((sum, item) => sum + item.portal.creaturesInside, 0)
  const threatenedCreatures = activeOnes
    .filter((item) => item.risk.rank === 'A' || item.risk.rank === 'S')
    .reduce((sum, item) => sum + item.portal.creaturesInside, 0)

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
    safeCreatures,
    threatenedCreatures,
    lostCreatures: state.portals.reduce(
      (sum, portal) => sum + (portal.creaturesLost ?? 0),
      0,
    ),
    stabilized: state.portals.filter((portal) => portal.stabilizedEver).length,
    decisions: state.decisionCount ?? 0,
    observerReturns: state.observerReturns ?? 0,
    unresolved:
      state.unresolvedAtEnd ??
      activeOnes.filter((item) => item.portal.decisionCycle !== currentCycle(state)).length,
    attention,
  }
}

export type ShiftOutcome = 'excellent' | 'controlled' | 'losses'

export interface ShiftSummary {
  durationMinutes: number
  cycles: number
  startedPortals: number
  remainingOpen: number
  stabilized: number
  closed: number
  collapsed: number
  critical: number
  questioned: number
  observersReturned: number
  safeCreatures: number
  threatenedCreatures: number
  lostCreatures: number
  decisions: number
  unresolved: number
  outcome: ShiftOutcome
  explanation: string
}

export function buildShiftSummary(state: LabState): ShiftSummary {
  const summary = buildSummary(state)
  const cycles = Math.floor((state.finishedAtMinutes ?? state.clockMinutes) / 15)
  const unresolved = state.unresolvedAtEnd ?? summary.unresolved
  const outcome: ShiftOutcome =
    summary.collapsed > 0 || summary.lostCreatures > 0
      ? 'losses'
      : summary.critical === 0 && unresolved === 0
        ? 'excellent'
        : 'controlled'

  const explanation =
    outcome === 'excellent'
      ? 'Ни один портал не схлопнулся, существа не потеряны, критических порталов не осталось.'
      : outcome === 'losses'
        ? `Есть потери: схлопнулось порталов — ${summary.collapsed}, потеряно существ — ${summary.lostCreatures}.`
        : `Существа не потеряны, но остались опасные или нерешённые порталы: критических — ${summary.critical}, без решения — ${unresolved}.`

  return {
    durationMinutes: state.finishedAtMinutes ?? state.clockMinutes,
    cycles,
    startedPortals: state.initialPortalCount ?? state.portals.length,
    remainingOpen: summary.active,
    stabilized: summary.stabilized,
    closed: summary.closed,
    collapsed: summary.collapsed,
    critical: summary.critical,
    questioned: summary.questioned,
    observersReturned: summary.observerReturns,
    safeCreatures: summary.safeCreatures,
    threatenedCreatures: summary.threatenedCreatures,
    lostCreatures: summary.lostCreatures,
    decisions: summary.decisions,
    unresolved,
    outcome,
    explanation,
  }
}

/** Порталы со ссылкой на риск — основа для таблицы в интерфейсе. */
export function withRisk(portals: Portal[]): PortalWithRisk[] {
  return portals.map((portal) => ({ portal, risk: computeRisk(portal) }))
}
