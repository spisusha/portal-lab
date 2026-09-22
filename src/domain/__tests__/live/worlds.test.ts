/**
 * Особенности миров: делают ровно то, что написано рядом с названием мира.
 *
 * Требование 6 чеклиста звучит именно так — «свойство применяется ровно
 * так, как написано пользователю». Поэтому здесь два уровня проверки:
 *
 *  1. Механика: цикл и стабилизация считаются по числам особенности.
 *  2. Текст: каждое число, названное в строке `effect`, действительно
 *     объявлено в полях особенности или является базовым значением.
 *     Так расхождение обещания с делом становится падающим тестом,
 *     а не тем, что замечают в проде.
 */
import { describe, expect, it } from 'vitest'
import {
  TRAIT_IDS,
  WORLD_TRAITS,
  scienceFactorOf,
  traitForWorld,
  traitOf,
} from '../../live/worlds'
import {
  NATURAL_ENERGY_GROWTH,
  NATURAL_STABILITY_DECAY,
  cyclePressure,
  projectPortal,
} from '../../cycle'
import { STABILIZE_ENERGY_DROP, STABILIZE_STEP, applyStabilize, stabilizePower } from '../../rules'
import { CYCLE_MINUTES } from '../../types'
import { livePortal } from './helpers'

describe('особенности миров', () => {
  it('у каждого из девяти миров ровно одна особенность и своё название', () => {
    expect(TRAIT_IDS).toHaveLength(9)
    const worlds = TRAIT_IDS.map((id) => WORLD_TRAITS[id].world)
    expect(new Set(worlds).size).toBe(9)
    const titles = TRAIT_IDS.map((id) => WORLD_TRAITS[id].title)
    expect(new Set(titles).size).toBe(9)
    for (const id of TRAIT_IDS) {
      expect(WORLD_TRAITS[id].effect.length).toBeGreaterThan(10)
      expect(traitForWorld(WORLD_TRAITS[id].world)?.id).toBe(id)
    }
  })

  it('не трогает демо-порталы: без особенности всё считается как в версии 1.0', () => {
    const plain = livePortal(null, { stability: 70, energy: 40, minutesToCollapse: 200 })

    expect(cyclePressure(plain)).toEqual({
      stabilityDecay: NATURAL_STABILITY_DECAY,
      energyGrowth: NATURAL_ENERGY_GROWTH,
      collapseDrain: CYCLE_MINUTES,
    })
    expect(stabilizePower(plain)).toEqual({
      step: STABILIZE_STEP,
      energyDrop: STABILIZE_ENERGY_DROP,
    })

    const after = projectPortal(plain)
    expect(after.stability).toBe(67)
    expect(after.energy).toBe(42)
    expect(after.minutesToCollapse).toBe(185)

    const stabilized = applyStabilize(plain)
    expect(stabilized.stability).toBe(95)
    expect(stabilized.energy).toBe(30)
  })

  it('«Топь тянет вниз» съедает вдвое больше времени — и ровно столько', () => {
    const portal = livePortal('marsh-drag', { minutesToCollapse: 90 })
    expect(cyclePressure(portal).collapseDrain).toBe(30)
    expect(projectPortal(portal).minutesToCollapse).toBe(60)
    // Остальное не затронуто.
    expect(projectPortal(portal).stability).toBe(67)
  })

  it('«Морозный контур» проседает на 1 и принимает стабилизацию на 15', () => {
    const portal = livePortal('frost-circuit', { stability: 50, energy: 60 })
    expect(projectPortal(portal).stability).toBe(49)
    const stabilized = applyStabilize(portal)
    expect(stabilized.stability).toBe(65)
    expect(stabilized.energy).toBe(50)
  })

  it('«Эхо резонанса» набирает +5 энергии за цикл', () => {
    expect(projectPortal(livePortal('echo-resonance', { energy: 40 })).energy).toBe(45)
  })

  it('«Каменный свод» не растит энергию и не гасит её стабилизацией', () => {
    const portal = livePortal('stone-vault', { energy: 40, stability: 50 })
    expect(projectPortal(portal).energy).toBe(40)
    const stabilized = applyStabilize(portal)
    expect(stabilized.energy).toBe(40)
    expect(stabilized.stability).toBe(75)
  })

  it('«Тихий сад» даёт +35 стабилизации, но половину научных данных', () => {
    const portal = livePortal('quiet-garden', { stability: 40 })
    expect(applyStabilize(portal).stability).toBe(75)
    expect(scienceFactorOf('quiet-garden')).toBe(0.5)
  })

  it('«Разлом Аркхан» проседает на 6 и даёт вдвое больше данных', () => {
    const portal = livePortal('abyss-rift', { stability: 50 })
    expect(projectPortal(portal).stability).toBe(44)
    expect(scienceFactorOf('abyss-rift')).toBe(2)
  })

  it('«Пепельный шлейф» растит энергию на 4 и гасит её на 20', () => {
    const portal = livePortal('ash-plume', { energy: 50, stability: 40 })
    expect(projectPortal(portal).energy).toBe(54)
    expect(applyStabilize(portal).energy).toBe(30)
  })

  it('«Немая тишина» не теряет стабильность сама, но растит энергию на 4', () => {
    const portal = livePortal('silent-halls', { stability: 60, energy: 30 })
    const after = projectPortal(portal)
    expect(after.stability).toBe(60)
    expect(after.energy).toBe(34)
  })

  it('«Сферы-поплавки» дают полуторные данные при стабилизации на 20', () => {
    expect(applyStabilize(livePortal('sphere-floats', { stability: 40 })).stability).toBe(60)
    expect(scienceFactorOf('sphere-floats')).toBe(1.5)
  })

  it('«Спокойное окно» гасит просадку контура любой особенности', () => {
    for (const id of TRAIT_IDS) {
      const portal = livePortal(id, { stability: 60 })
      expect(projectPortal(portal, { calm: true }).stability).toBe(60)
    }
  })

  /**
   * Текст особенности — обещание интерфейса. Если в нём написано «−30 мин»,
   * а в полях стоит 15, человек примет решение по неверным данным.
   */
  it('каждое число из описания особенности объявлено в её полях', () => {
    const base = new Set([
      NATURAL_STABILITY_DECAY,
      NATURAL_ENERGY_GROWTH,
      CYCLE_MINUTES,
      STABILIZE_STEP,
      STABILIZE_ENERGY_DROP,
    ])

    for (const id of TRAIT_IDS) {
      const trait = WORLD_TRAITS[id]
      const declared = new Set<number>([
        ...base,
        ...[
          trait.stabilityDecay,
          trait.energyGrowth,
          trait.collapseDrain,
          trait.stabilizeStep,
          trait.stabilizeEnergyDrop,
        ].filter((value): value is number => value !== undefined),
      ])
      const mentioned = (trait.effect.match(/\d+/g) ?? []).map(Number)
      for (const value of mentioned) {
        expect(
          declared.has(value),
          `«${trait.title}»: в описании названо ${value}, но такого числа нет ни в базовых величинах, ни в полях особенности`,
        ).toBe(true)
      }
    }
  })

  it('пустая особенность безопасна и означает обычный мир', () => {
    expect(traitOf(null)).toBeNull()
    expect(traitOf(undefined)).toBeNull()
    expect(scienceFactorOf(null)).toBe(1)
    expect(traitForWorld('Мир, которого нет')).toBeNull()
  })
})
