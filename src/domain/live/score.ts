/**
 * Итоговая оценка «Живой смены».
 *
 * У демонстрационных сценариев итог словесный («Смена под контролем») и
 * этого достаточно: их задача — показать краевые случаи, а не соревноваться.
 * Переигрываемая смена без числа бессмысленна: невозможно понять, стала ли
 * вторая попытка лучше первой.
 *
 * Счёт устроен так, чтобы его можно было пересказать вслух: четыре блока,
 * каждый со своим потолком, сумма — сто. Ни одного скрытого множителя и ни
 * одного бонуса «за стиль». Каждый блок возвращает не только очки, но и
 * строку объяснения — именно она показывается в отчёте, а число рядом.
 *
 * Вес директивы намеренно самый маленький: ТЗ прямо требует, чтобы её
 * невыполнение не объявляло смену проваленной при хороших основных
 * показателях. Десять очков из ста этому ровно и соответствуют: без
 * директивы можно получить A, но не S.
 */

import type { LabState, Portal } from '../types'
import { isActive } from '../types'
import { scienceFactorOf } from './worlds'
import { evaluateDirective, type DirectiveResult } from './directives'

/** За что начисляются научные данные. */
export type ScienceKind = 'STABILIZE' | 'OBSERVER' | 'HELD'

/** Базовая ценность каждого источника данных до множителя мира. */
export const SCIENCE_AWARD: Record<ScienceKind, number> = {
  /** Замер контура во время стабилизации — дёшево, но регулярно. */
  STABILIZE: 6,
  /** Отчёт вернувшегося наблюдателя — главный источник данных. */
  OBSERVER: 25,
  /** Портал, удержанный открытым до конца смены, — долгое наблюдение. */
  HELD: 12,
}

/**
 * Сколько данных считается полной научной программой смены.
 *
 * Ориентир: два вернувшихся наблюдателя, три стабилизации и три портала,
 * доживших до конца, дают примерно столько. Больше — потолок блока.
 */
export const SCIENCE_TARGET = 140

export interface ScienceEntry {
  kind: ScienceKind
  /** Номер цикла, считая с 1. */
  cycle: number
  portalId: string
  portalName: string
  /** Множитель мира: особенность может удвоить или урезать данные вдвое. */
  factor: number
  points: number
}

const SCIENCE_LABELS: Record<ScienceKind, string> = {
  STABILIZE: 'замер контура при стабилизации',
  OBSERVER: 'отчёт вернувшегося наблюдателя',
  HELD: 'портал удержан открытым до конца смены',
}

export function scienceLabel(kind: ScienceKind): string {
  return SCIENCE_LABELS[kind]
}

/** Одна запись о полученных данных. Множитель берётся из особенности мира. */
export function scienceEntry(
  kind: ScienceKind,
  portal: Portal,
  cycle: number,
): ScienceEntry {
  const factor = scienceFactorOf(portal.trait)
  return {
    kind,
    cycle,
    portalId: portal.id,
    portalName: portal.name,
    factor,
    points: Math.round(SCIENCE_AWARD[kind] * factor),
  }
}

export function totalScience(entries: ScienceEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.points, 0)
}

export type LiveRank = 'S' | 'A' | 'B' | 'C' | 'D'

export interface ScorePart {
  key: 'safety' | 'integrity' | 'science' | 'directive'
  title: string
  points: number
  max: number
  /** Откуда взялись очки — человеческим языком, с числами. */
  explanation: string
}

export interface LiveScore {
  /** Итог 0–100. */
  total: number
  rank: LiveRank
  /** Словесное дублирование ранга: опасность и успех не кодируются цветом. */
  label: string
  parts: ScorePart[]
  directive: DirectiveResult
  science: number
  /** Одна фраза о том, чем эта смена запомнилась. */
  headline: string
}

export const LIVE_RANK_LABELS: Record<LiveRank, string> = {
  S: 'образцовая смена',
  A: 'сильная смена',
  B: 'рабочая смена',
  C: 'смена с потерями',
  D: 'смена сорвана',
}

/** Нижние границы рангов, включительно. */
const RANK_THRESHOLDS: Array<{ min: number; rank: LiveRank }> = [
  { min: 90, rank: 'S' },
  { min: 78, rank: 'A' },
  { min: 62, rank: 'B' },
  { min: 45, rank: 'C' },
  { min: 0, rank: 'D' },
]

export function liveRankForScore(total: number): LiveRank {
  return RANK_THRESHOLDS.find((step) => total >= step.min)?.rank ?? 'D'
}

/** Шкала для легенды в отчёте. Выводится из тех же порогов, что и ранг. */
export const LIVE_RANK_SCALE = [...RANK_THRESHOLDS]
  .sort((a, b) => a.min - b.min)
  .map((step, index, all) => ({
    rank: step.rank,
    label: LIVE_RANK_LABELS[step.rank],
    min: step.min,
    max: index + 1 < all.length ? all[index + 1].min - 1 : 100,
  }))
  .reverse()

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export function computeLiveScore(state: LabState): LiveScore | null {
  const live = state.live
  if (!live) return null

  const portals = state.portals
  const started = state.initialPortalCount ?? portals.length

  // 1. Безопасность существ. Существо считается потерянным, если осталось
  //    в закрытом или схлопнувшемся портале — способ потери роли не играет.
  const creatures = portals.reduce((sum, portal) => sum + portal.creaturesInside, 0)
  const lost = portals.reduce((sum, portal) => sum + (portal.creaturesLost ?? 0), 0)
  const saved = Math.max(0, creatures - lost)
  const safetyPoints =
    creatures === 0 ? 40 : Math.round((40 * saved) / creatures)

  // 2. Сохранность порталов. Управляемое закрытие потерей не считается:
  //    ТЗ прямо называет его лучшим исходом, чем схлопывание.
  const collapsed = portals.filter((portal) => portal.status === 'COLLAPSED').length
  const integrityPoints =
    started === 0 ? 30 : Math.round(30 * (1 - collapsed / started))

  // 3. Научные данные — то, ради чего лаборатория вообще держит порталы.
  const science = totalScience(live.science)
  const sciencePoints = clamp(Math.round((20 * science) / SCIENCE_TARGET), 0, 20)

  // 4. Директива.
  const directive = evaluateDirective(live.directive, state)
  const directivePoints = directive.met ? 10 : 0

  const parts: ScorePart[] = [
    {
      key: 'safety',
      title: 'Безопасность существ',
      points: clamp(safetyPoints, 0, 40),
      max: 40,
      explanation:
        creatures === 0
          ? 'Существ в порталах не было — терять было некого, блок засчитан полностью.'
          : `Спасено ${saved} существ из ${creatures}; потеряно ${lost}.`,
    },
    {
      key: 'integrity',
      title: 'Сохранность порталов',
      points: clamp(integrityPoints, 0, 30),
      max: 30,
      explanation:
        collapsed === 0
          ? `Ни один из ${started} порталов не схлопнулся.`
          : `Схлопнулось ${collapsed} из ${started}. Управляемое закрытие потерей не считается.`,
    },
    {
      key: 'science',
      title: 'Научные данные',
      points: sciencePoints,
      max: 20,
      explanation: `Собрано ${science} единиц данных из ${SCIENCE_TARGET} возможных за смену.`,
    },
    {
      key: 'directive',
      title: 'Директива смены',
      points: directivePoints,
      max: 10,
      explanation: `${directive.directive.title}. ${directive.explanation}`,
    },
  ]

  const total = clamp(
    parts.reduce((sum, part) => sum + part.points, 0),
    0,
    100,
  )
  const rank = liveRankForScore(total)

  return {
    total,
    rank,
    label: LIVE_RANK_LABELS[rank],
    parts,
    directive,
    science,
    headline: headlineFor(parts, collapsed, lost, portals),
  }
}

function headlineFor(
  parts: ScorePart[],
  collapsed: number,
  lost: number,
  portals: Portal[],
): string {
  if (collapsed === 0 && lost === 0) {
    const held = portals.filter(isActive).length
    return `Ни одного схлопывания и ни одного потерянного существа; открытыми осталось порталов: ${held}.`
  }
  const weakest = [...parts].sort(
    (a, b) => a.points / a.max - b.points / b.max,
  )[0]
  return `Больше всего очков потеряно в блоке «${weakest.title.toLowerCase()}»: ${weakest.points} из ${weakest.max}.`
}
