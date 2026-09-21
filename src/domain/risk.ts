/**
 * Расчёт риска портала.
 *
 * Формула намеренно простая и линейная: её можно объяснить проверяющему
 * за полминуты, а результат — разложить на слагаемые. Поэтому функция
 * возвращает не одно число, а разбор: сколько процентных пунктов риска
 * дал каждый фактор. Именно этот разбор показывается в карточке портала.
 */

import type { Portal, RiskRank } from './types'
import { isActive } from './types'

/**
 * Горизонт планирования: 3 часа.
 * Портал, до схлопывания которого больше 180 минут, не создаёт временнóго
 * давления вообще; чем ближе к нулю — тем давление выше.
 */
export const TIME_HORIZON_MINUTES = 180

/** Каждое существо внутри добавляет 20 пунктов давления, максимум 100. */
export const CREATURE_WEIGHT = 20

export const RISK_WEIGHTS = {
  instability: 0.35,
  energy: 0.3,
  time: 0.25,
  creatures: 0.1,
} as const

export interface RiskPart {
  key: keyof typeof RISK_WEIGHTS
  title: string
  /** Вес фактора в формуле, 0–1. */
  weight: number
  /** Нормализованное значение фактора, 0–100. */
  raw: number
  /** Вклад в итоговый риск в пунктах: weight × raw. */
  contribution: number
  /** Человеческое объяснение, откуда взялось raw. */
  explanation: string
}

export interface RiskBreakdown {
  /** Итоговый риск, 0–100, округлён до целого. */
  score: number
  rank: RiskRank
  /** Словесное дублирование ранга — чтобы шкала читалась без легенды. */
  label: string
  parts: RiskPart[]
  /**
   * false для закрытых и схлопнувшихся порталов: риск к ним неприменим,
   * такой портал не должен висеть в списке «требуют внимания».
   */
  applicable: boolean
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const RANK_LABELS: Record<RiskRank, string> = {
  E: 'минимальный',
  D: 'низкий',
  C: 'умеренный',
  B: 'повышенный',
  A: 'высокий',
  S: 'критический',
}

/** Порог ранга — нижняя граница включительно. */
const RANK_THRESHOLDS: Array<{ min: number; rank: RiskRank }> = [
  { min: 85, rank: 'S' },
  { min: 69, rank: 'A' },
  { min: 51, rank: 'B' },
  { min: 33, rank: 'C' },
  { min: 16, rank: 'D' },
  { min: 0, rank: 'E' },
]

/**
 * Шкала рангов для легенды в интерфейсе — от безобидного к критическому.
 * Границы берутся из тех же порогов, по которым считается ранг: легенда
 * не имеет права разойтись с формулой, поэтому она выводится, а не набита
 * руками в компоненте.
 */
export const RANK_SCALE: Array<{
  rank: RiskRank
  label: string
  min: number
  max: number
}> = [...RANK_THRESHOLDS]
  .sort((a, b) => a.min - b.min)
  .map((item, index, all) => ({
    rank: item.rank,
    label: RANK_LABELS[item.rank],
    min: item.min,
    max: index + 1 < all.length ? all[index + 1].min - 1 : 100,
  }))

export function rankForScore(score: number): RiskRank {
  const found = RANK_THRESHOLDS.find((t) => score >= t.min)
  return found ? found.rank : 'E'
}

/** Ранги A и S считаются критическими: при них запрещена разведка. */
export function isCriticalRank(rank: RiskRank): boolean {
  return rank === 'A' || rank === 'S'
}

export function computeRisk(portal: Portal): RiskBreakdown {
  if (!isActive(portal)) {
    return {
      score: 0,
      rank: 'E',
      label: 'риск снят',
      parts: [],
      applicable: false,
    }
  }

  const instabilityRaw = clamp(100 - portal.stability, 0, 100)
  const energyRaw = clamp(portal.energy, 0, 100)
  const timeRaw = clamp(
    100 - (portal.minutesToCollapse / TIME_HORIZON_MINUTES) * 100,
    0,
    100,
  )
  const creaturesRaw = clamp(portal.creaturesInside * CREATURE_WEIGHT, 0, 100)

  const parts: RiskPart[] = [
    {
      key: 'instability',
      title: 'Нестабильность',
      weight: RISK_WEIGHTS.instability,
      raw: instabilityRaw,
      contribution: RISK_WEIGHTS.instability * instabilityRaw,
      explanation: `стабильность ${portal.stability} из 100, значит нестабильность ${instabilityRaw}`,
    },
    {
      key: 'energy',
      title: 'Энергия',
      weight: RISK_WEIGHTS.energy,
      raw: energyRaw,
      contribution: RISK_WEIGHTS.energy * energyRaw,
      explanation: `уровень энергии ${portal.energy} из 100`,
    },
    {
      key: 'time',
      title: 'Нехватка времени',
      weight: RISK_WEIGHTS.time,
      raw: timeRaw,
      contribution: RISK_WEIGHTS.time * timeRaw,
      explanation:
        portal.minutesToCollapse >= TIME_HORIZON_MINUTES
          ? `до схлопывания больше ${TIME_HORIZON_MINUTES} мин — времени достаточно`
          : `до схлопывания ${portal.minutesToCollapse} мин из горизонта ${TIME_HORIZON_MINUTES}`,
    },
    {
      key: 'creatures',
      title: 'Существа внутри',
      weight: RISK_WEIGHTS.creatures,
      raw: creaturesRaw,
      contribution: RISK_WEIGHTS.creatures * creaturesRaw,
      explanation: portal.creaturesConfirmed
        ? `подтверждено существ: ${portal.creaturesInside}`
        : `по приборам около ${portal.creaturesInside} — число не подтверждено`,
    },
  ]

  const score = Math.round(
    parts.reduce((sum, part) => sum + part.contribution, 0),
  )
  const rank = rankForScore(score)

  return {
    score,
    rank,
    label: RANK_LABELS[rank],
    parts,
    applicable: true,
  }
}

/** Текстовая запись формулы — показывается в интерфейсе и в README. */
export const RISK_FORMULA_TEXT =
  'риск = 0.35 × (100 − стабильность) + 0.30 × энергия + 0.25 × нехватка времени + 0.10 × существа внутри'

/** Фактор, давший наибольший вклад в риск. null — если риск неприменим. */
export function dominantPart(risk: RiskBreakdown): RiskPart | null {
  if (!risk.applicable || risk.parts.length === 0) return null
  return risk.parts.reduce((top, part) =>
    part.contribution > top.contribution ? part : top,
  )
}

/**
 * Короткое человеческое объяснение риска — одна фраза вместо таблицы.
 *
 * Показывается до раскрытия подробных вычислений: сначала человек понимает,
 * что не так, и только если захочет — смотрит арифметику. Текст собирается
 * здесь, а не в компоненте, потому что опирается на веса формулы.
 */
export function riskHeadline(risk: RiskBreakdown): string {
  if (!risk.applicable) {
    return 'Портал в терминальном статусе — риск к нему больше не считается.'
  }
  const top = dominantPart(risk)
  if (!top) return `Риск ${risk.score} из 100.`
  return `Больше всего риска даёт «${top.title.toLowerCase()}»: ${top.explanation}.`
}
