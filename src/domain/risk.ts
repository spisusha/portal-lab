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
