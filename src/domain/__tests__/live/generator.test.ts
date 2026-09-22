/**
 * Генератор живой смены: воспроизводимость, разнообразие и границы.
 *
 * Тесты намеренно идут по набору из нескольких десятков кодов, а не по
 * одному удачному: генератор с отбраковкой легко «случайно работает» на
 * том seed, на котором его писали.
 */
import { describe, expect, it } from 'vitest'
import {
  LIVE_BOUNDS,
  LIVE_PORTAL_COUNT,
  TIME_STEP,
  buildLiveShift,
  createLiveShift,
  shiftIsPlayable,
} from '../../live/generator'
import { computeRisk } from '../../risk'
import { checkAction } from '../../rules'
import { MAX_CYCLES, isActive } from '../../types'
import { WORLD_TRAITS } from '../../live/worlds'
import { seedSample } from './helpers'

const SEEDS = seedSample()

describe('воспроизводимость смены по seed', () => {
  // Требование 1 чеклиста: один seed всегда создаёт одинаковую смену.
  it('один и тот же код даёт одинаковые порталы, события и директиву', () => {
    for (const seed of SEEDS) {
      const first = createLiveShift(seed)
      const second = createLiveShift(seed)
      expect(second).toEqual(first)
    }
  })

  it('регистр кода не влияет на смену', () => {
    const upper = createLiveShift('PL-7K42')
    const lower = createLiveShift('pl-7k42')
    expect(lower.portals).toEqual(upper.portals)
    expect(lower.live?.seed).toBe('PL-7K42')
  })

  // Требование 2 чеклиста: разные seed создают различающиеся смены.
  it('разные коды почти всегда дают разные смены', () => {
    const fingerprints = SEEDS.map((seed) =>
      createLiveShift(seed)
        .portals.map(
          (portal) =>
            `${portal.world}:${portal.energy}:${portal.stability}:${portal.minutesToCollapse}`,
        )
        .join('|'),
    )
    expect(new Set(fingerprints).size).toBe(SEEDS.length)
  })

  it('расписание событий и директива тоже воспроизводятся', () => {
    for (const seed of SEEDS.slice(0, 12)) {
      const a = buildLiveShift(seed)
      const b = buildLiveShift(seed)
      expect(b.live.schedule).toEqual(a.live.schedule)
      expect(b.live.directive).toEqual(a.live.directive)
    }
  })
})

describe('состав смены', () => {
  // Требование 3 чеклиста: пять уникальных активных порталов.
  it('создаёт ровно пять активных порталов с разными id и мирами', () => {
    for (const seed of SEEDS) {
      const state = createLiveShift(seed)
      expect(state.portals).toHaveLength(LIVE_PORTAL_COUNT)
      expect(state.portals.every(isActive)).toBe(true)
      expect(new Set(state.portals.map((p) => p.id)).size).toBe(LIVE_PORTAL_COUNT)
      expect(new Set(state.portals.map((p) => p.name)).size).toBe(LIVE_PORTAL_COUNT)
      expect(new Set(state.portals.map((p) => p.world)).size).toBe(LIVE_PORTAL_COUNT)
    }
  })

  it('берёт только существующие миры и вешает на портал их особенность', () => {
    const worlds = new Set(Object.values(WORLD_TRAITS).map((trait) => trait.world))
    for (const seed of SEEDS) {
      for (const portal of createLiveShift(seed).portals) {
        expect(worlds.has(portal.world)).toBe(true)
        expect(portal.trait).toBeTruthy()
        expect(WORLD_TRAITS[portal.trait!].world).toBe(portal.world)
      }
    }
  })

  // Требование 4 чеклиста: показатели в допустимых диапазонах.
  it('держит все показатели в границах, а время — кратным циклу', () => {
    for (const seed of SEEDS) {
      for (const portal of createLiveShift(seed).portals) {
        expect(portal.energy).toBeGreaterThanOrEqual(LIVE_BOUNDS.energy.min)
        expect(portal.energy).toBeLessThanOrEqual(LIVE_BOUNDS.energy.max)
        expect(portal.stability).toBeGreaterThanOrEqual(LIVE_BOUNDS.stability.min)
        expect(portal.stability).toBeLessThanOrEqual(LIVE_BOUNDS.stability.max)
        expect(portal.minutesToCollapse).toBeGreaterThanOrEqual(LIVE_BOUNDS.minutes.min)
        expect(portal.minutesToCollapse).toBeLessThanOrEqual(LIVE_BOUNDS.minutes.max)
        expect(portal.minutesToCollapse % TIME_STEP).toBe(0)
        expect(portal.creaturesInside).toBeGreaterThanOrEqual(LIVE_BOUNDS.creatures.min)
        expect(portal.creaturesInside).toBeLessThanOrEqual(LIVE_BOUNDS.creatures.max)
        expect(portal.creaturesActual).toBeGreaterThanOrEqual(LIVE_BOUNDS.creatures.min)
        expect(portal.creaturesActual).toBeLessThanOrEqual(LIVE_BOUNDS.creatures.max)
        // Приборы ошибаются не больше чем на одно существо.
        expect(Math.abs(portal.creaturesActual - portal.creaturesInside)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('не выдаёт ни бессмысленной, ни непроходимой смены', () => {
    for (const seed of SEEDS) {
      const state = createLiveShift(seed)
      expect(shiftIsPlayable(state.portals)).toBe(true)

      const ranks = state.portals.map((portal) => computeRisk(portal).rank)
      // Хотя бы один портал, который действительно требует решения сейчас.
      expect(
        ranks.some((rank) => rank === 'B' || rank === 'A' || rank === 'S') ||
          state.portals.some((portal) => portal.minutesToCollapse <= 30),
      ).toBe(true)
      // И хотя бы два спокойных, иначе смена безнадёжна с первой секунды.
      expect(ranks.filter((rank) => rank === 'E' || rank === 'D' || rank === 'C').length)
        .toBeGreaterThanOrEqual(2)
      // Разведка доступна хотя бы где-то — иначе половина механик мертва.
      expect(
        state.portals.filter((portal) => checkAction(portal, 'SEND_OBSERVER').allowed).length,
      ).toBeGreaterThanOrEqual(2)
    }
  })

  it('заводит журнал, счётчики и расписание на всю смену', () => {
    const state = createLiveShift('PL-7K42')
    expect(state.scenario).toBe('live')
    expect(state.shiftStatus).toBe('ACTIVE')
    expect(state.initialPortalCount).toBe(LIVE_PORTAL_COUNT)
    expect(state.decisionCount).toBe(0)
    expect(state.live?.schedule).toHaveLength(MAX_CYCLES)
    expect(state.live?.timeline).toEqual([])
    expect(state.live?.science).toEqual([])
    expect(state.log[0].text).toContain('PL-7K42')
  })

  it('без кода открывает запасную смену, а не падает', () => {
    const state = createLiveShift('')
    expect(state.portals).toHaveLength(LIVE_PORTAL_COUNT)
    expect(state.live?.seed).toBeTruthy()
  })
})
