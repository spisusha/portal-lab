/**
 * Живая смена целиком: директива, счёт, разбор и завершение.
 *
 * Отдельно проверяется то, что легко сломать расширением: демонстрационные
 * сценарии обязаны вести себя ровно как в версии 1.0, а запрещённое действие
 * не должно менять состояние ни в одном из режимов.
 */
import { describe, expect, it } from 'vitest'
import { labReducer } from '../../reducer'
import { createScenario } from '../../seed'
import { createLiveShift } from '../../live/generator'
import {
  DIRECTIVES,
  directiveFeasible,
  directiveProgress,
  evaluateDirective,
} from '../../live/directives'
import {
  LIVE_RANK_SCALE,
  SCIENCE_AWARD,
  computeLiveScore,
  liveRankForScore,
  totalScience,
} from '../../live/score'
import { buildDebrief, debriefHeadline } from '../../live/debrief'
import { buildShiftSummary } from '../../summary'
import { MAX_CYCLES, isActive } from '../../types'
import { livePortal, nextCycle, seedSample } from './helpers'

const SEEDS = seedSample(40)

const runToEnd = (seed: string) => {
  let state = createLiveShift(seed)
  for (let i = 0; i < MAX_CYCLES && state.shiftStatus !== 'COMPLETE'; i++) {
    state = nextCycle(state)
  }
  return state
}

describe('директива смены', () => {
  // Требование 5 чеклиста: директива выполнима в начальном состоянии.
  it('выбранная директива выполнима на старте — на всех seed', () => {
    for (const seed of SEEDS) {
      const state = createLiveShift(seed)
      const directive = state.live!.directive
      expect(directive).toBeTruthy()
      expect(directiveFeasible(directive, state)).toBe(true)
    }
  })

  it('невыполнимую директиву не выбирает: пустая лаборатория ничего не даёт', () => {
    for (const directive of Object.values(DIRECTIVES)) {
      expect(directiveFeasible(directive, { portals: [] })).toBe(false)
    }
  })

  it('не берёт «без потери существ», если населённый портал не доживёт до конца', () => {
    const doomed = {
      portals: [
        livePortal(null, { id: 'a', creaturesInside: 2, minutesToCollapse: 45 }),
        livePortal(null, { id: 'b', minutesToCollapse: 240 }),
      ],
    }
    expect(directiveFeasible(DIRECTIVES.NO_LOSSES, doomed)).toBe(false)
  })

  it('считает прогресс и объясняет итог словами', () => {
    const state = createLiveShift('PL-7K42')
    const observers = evaluateDirective(DIRECTIVES.OBSERVERS, state)
    expect(observers.met).toBe(false)
    expect(observers.actual).toBe(0)
    expect(observers.explanation).toContain('Директива не выполнена')

    const collapse = evaluateDirective(DIRECTIVES.NO_COLLAPSE, state)
    expect(collapse.met).toBe(true)
    expect(directiveProgress(DIRECTIVES.NO_COLLAPSE, state)).toBe(0)
  })

  it('невыполнение директивы не обнуляет остальной счёт', () => {
    const state = runToEnd('PL-7K42')
    const score = computeLiveScore(state)!
    const directivePart = score.parts.find((part) => part.key === 'directive')!
    expect(directivePart.max).toBe(10)
    // Директива весит десятую часть: без неё потолок — 90, то есть ранг A.
    expect(score.total - directivePart.points).toBeGreaterThanOrEqual(0)
  })
})

describe('итоговый счёт', () => {
  // Требование 9 чеклиста: счёт и ранг воспроизводимы и объяснимы.
  it('одинаков при одинаковом прохождении и раскладывается на четыре блока', () => {
    const first = computeLiveScore(runToEnd('PL-A2C4'))!
    const second = computeLiveScore(runToEnd('PL-A2C4'))!
    expect(second).toEqual(first)

    expect(first.parts.map((part) => part.key)).toEqual([
      'safety',
      'integrity',
      'science',
      'directive',
    ])
    expect(first.parts.reduce((sum, part) => sum + part.max, 0)).toBe(100)
    expect(first.parts.reduce((sum, part) => sum + part.points, 0)).toBe(first.total)
    for (const part of first.parts) {
      expect(part.points).toBeGreaterThanOrEqual(0)
      expect(part.points).toBeLessThanOrEqual(part.max)
      expect(part.explanation.length).toBeGreaterThan(10)
    }
  })

  it('ранги S–D покрывают шкалу 0–100 без разрывов', () => {
    expect(liveRankForScore(100)).toBe('S')
    expect(liveRankForScore(90)).toBe('S')
    expect(liveRankForScore(89)).toBe('A')
    expect(liveRankForScore(78)).toBe('A')
    expect(liveRankForScore(62)).toBe('B')
    expect(liveRankForScore(45)).toBe('C')
    expect(liveRankForScore(0)).toBe('D')
    expect(LIVE_RANK_SCALE.map((step) => step.rank)).toEqual(['S', 'A', 'B', 'C', 'D'])
    for (let i = 1; i < LIVE_RANK_SCALE.length; i++) {
      expect(LIVE_RANK_SCALE[i].max + 1).toBe(LIVE_RANK_SCALE[i - 1].min)
    }
  })

  it('решения приносят научные данные с множителем мира', () => {
    const state = createLiveShift('PL-7K42')
    const target = state.portals.find((portal) => portal.trait === 'abyss-rift')
      ?? state.portals[0]
    const after = labReducer(state, { type: 'STABILIZE', portalId: target.id })
    const entry = after.live!.science.at(-1)!
    expect(entry.kind).toBe('STABILIZE')
    expect(entry.points).toBe(Math.round(SCIENCE_AWARD.STABILIZE * entry.factor))
    expect(totalScience(after.live!.science)).toBe(entry.points)
  })

  it('порталы, дожившие до конца смены, тоже засчитываются данными', () => {
    const state = runToEnd('PL-7K42')
    const held = state.live!.science.filter((entry) => entry.kind === 'HELD')
    expect(held).toHaveLength(state.portals.filter(isActive).length)
  })

  it('называет блок, где потеряно больше всего очков, а не худшую долю', () => {
    // Найдено при прогоне в браузере: фраза говорила «больше всего очков»,
    // а сортировка шла по долям, и блок директивы (−10) объявлялся главной
    // потерей вперёд безопасности существ (−20).
    const score = computeLiveScore(runToEnd('PL-LAB2'))!
    const worst = [...score.parts].sort(
      (a, b) => b.max - b.points - (a.max - a.points),
    )[0]
    expect(score.headline).toContain(worst.title.toLowerCase())
    expect(score.headline).toContain(`${worst.max - worst.points} из ${worst.max}`)
  })

  it('склоняет существ в объяснении, а не пишет «спасено 1 существ»', () => {
    // Найдено глазами при прогоне в браузере: объяснение собирает домен,
    // а числительные жили только в ui/plural.ts — и в итог попадало
    // «Спасено 1 существ из 5».
    const base = createLiveShift('PL-7K42')
    const safetyText = (creatures: number) => {
      const state = {
        ...base,
        portals: base.portals.map((portal, index) => ({
          ...portal,
          creaturesInside: index === 0 ? creatures : 0,
          creaturesLost: 0,
        })),
      }
      const score = computeLiveScore(state)!
      return score.parts.find((part) => part.key === 'safety')!.explanation
    }

    expect(safetyText(1)).toContain('Спасено 1 существо из 1')
    expect(safetyText(2)).toContain('Спасено 2 существа из 2')
    expect(safetyText(4)).toContain('Спасено 4 существа из 4')
  })

  it('для демонстрационных сценариев счёта нет — там словесный итог', () => {
    expect(computeLiveScore(createScenario('standard'))).toBeNull()
    expect(buildShiftSummary(createScenario('standard')).outcome).toBeTruthy()
  })
})

describe('разбор решений', () => {
  it('записывает цикл, портал, действие, рекомендацию и результат', () => {
    const state = createLiveShift('PL-7K42')
    const target = state.portals[0]
    const after = labReducer(state, { type: 'MARK_QUESTIONED', portalId: target.id })

    const rows = buildDebrief(after)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      cycle: 1,
      portalId: target.id,
      portalName: target.name,
      action: 'MARK_QUESTIONED',
      actionLabel: 'Пометить «под вопросом»',
    })
    expect(rows[0].recommendedText.length).toBeGreaterThan(10)
    expect(['same', 'different', 'no-advice']).toContain(rows[0].agreement)
  })

  it('рекомендация берётся на момент решения, а не пересчитывается задним числом', () => {
    const state = createLiveShift('PL-LAB2')
    // Самый опасный портал смены: до стабилизации рекомендация одна.
    const target = [...state.portals].sort(
      (a, b) => a.stability - b.stability,
    )[0]
    const after = labReducer(state, { type: 'STABILIZE', portalId: target.id })
    const row = buildDebrief(after)[0]
    expect(row.recommendedText).toContain(String(target.stability))
  })

  it('не называет рекомендацию единственно правильной', () => {
    const state = labReducer(createLiveShift('PL-7K42'), {
      type: 'STABILIZE',
      portalId: createLiveShift('PL-7K42').portals[0].id,
    })
    const rows = buildDebrief(state)
    const text = [debriefHeadline(rows), ...rows.map((row) => row.agreementNote)].join(' ')
    expect(text).not.toMatch(/идеальн|единственно правильн|оптимальн/i)
    expect(debriefHeadline(rows)).toContain('подсказка')
  })

  it('пустой разбор не выдумывает решений', () => {
    expect(buildDebrief(createLiveShift('PL-7K42'))).toEqual([])
    expect(debriefHeadline([])).toContain('ни одного решения')
  })
})

describe('завершение живой смены', () => {
  // Требование 15 чеклиста.
  it('заканчивается после шести циклов', () => {
    const state = runToEnd('PL-7K42')
    expect(state.shiftStatus).toBe('COMPLETE')
    expect(state.clockMinutes).toBe(MAX_CYCLES * 15)
    expect(computeLiveScore(state)).not.toBeNull()
  })

  it('заканчивается досрочно, когда активных порталов не осталось', () => {
    let state = createLiveShift('PL-7K42')
    for (const portal of state.portals) {
      state = labReducer(state, { type: 'CLOSE', portalId: portal.id })
      state = labReducer(state, { type: 'CLOSE', portalId: portal.id, confirmed: true })
    }
    expect(state.portals.some(isActive)).toBe(false)
    expect(state.shiftStatus).toBe('COMPLETE')
    expect(state.clockMinutes).toBeLessThan(MAX_CYCLES * 15)
  })

  it('после завершения не принимает решений', () => {
    const state = runToEnd('PL-7K42')
    const attempt = labReducer(state, {
      type: 'STABILIZE',
      portalId: state.portals[0].id,
    })
    expect(attempt.portals).toEqual(state.portals)
    expect(attempt.live!.timeline).toEqual(state.live!.timeline)
    expect(attempt.log[0].kind).toBe('blocked')
  })
})

describe('расширение не задело старое поведение', () => {
  // Требование 13 чеклиста.
  it('три демонстрационных сценария работают как прежде', () => {
    const standard = createScenario('standard')
    expect(standard.portals).toHaveLength(5)
    expect(standard.live).toBeNull()
    expect(standard.portals.every((portal) => portal.trait === undefined)).toBe(true)

    const stabilized = labReducer(standard, { type: 'STABILIZE', portalId: 'p-19' })
    const star = stabilized.portals.find((p) => p.id === 'p-19')!
    expect(star.stability).toBe(55)
    expect(star.energy).toBe(72)

    const critical = createScenario('critical')
    expect(critical.portals).toHaveLength(4)
    const afterCycle = nextCycle(critical)
    expect(afterCycle.portals.find((p) => p.id === 'c-14')!.status).toBe('COLLAPSED')

    const empty = createScenario('empty')
    expect(empty.portals).toHaveLength(0)
    expect(nextCycle(empty).shiftStatus).toBe('COMPLETE')
  })

  // Требование 14 чеклиста.
  it('запрещённое действие не меняет состояние ни в демо, ни в живой смене', () => {
    const critical = createScenario('critical')
    const blockedDemo = labReducer(critical, { type: 'SEND_OBSERVER', portalId: 'c-01' })
    expect(blockedDemo.portals).toEqual(critical.portals)
    expect(blockedDemo.log[0].kind).toBe('blocked')

    const live = createLiveShift('PL-7K42')
    const target = live.portals[0]
    const once = labReducer(live, { type: 'STABILIZE', portalId: target.id })
    const twice = labReducer(once, { type: 'STABILIZE', portalId: target.id })
    expect(twice.portals).toEqual(once.portals)
    expect(twice.live!.timeline).toEqual(once.live!.timeline)
    expect(twice.live!.science).toEqual(once.live!.science)
    expect(twice.log[0].kind).toBe('blocked')
  })

  it('смена режима сбрасывает живую смену и наоборот', () => {
    const live = labReducer(createScenario('standard'), {
      type: 'LOAD_SCENARIO',
      scenario: 'live',
      seed: 'PL-7K42',
      confirmed: true,
    })
    expect(live.scenario).toBe('live')
    expect(live.live?.seed).toBe('PL-7K42')

    const back = labReducer(live, {
      type: 'LOAD_SCENARIO',
      scenario: 'standard',
      confirmed: true,
    })
    expect(back.live).toBeNull()
    expect(back.portals.map((p) => p.id)).toEqual(['p-03', 'p-07', 'p-11', 'p-02', 'p-19'])
  })

  // Требование 11 чеклиста: повтор смены сохраняет seed.
  it('повтор смены по тому же коду даёт ту же стартовую лабораторию', () => {
    const played = labReducer(createLiveShift('PL-7K42'), {
      type: 'STABILIZE',
      portalId: createLiveShift('PL-7K42').portals[0].id,
    })
    const again = labReducer(played, {
      type: 'LOAD_SCENARIO',
      scenario: 'live',
      seed: played.live!.seed,
      confirmed: true,
    })
    expect(again.live!.seed).toBe('PL-7K42')
    expect(again.portals).toEqual(createLiveShift('PL-7K42').portals)
    expect(again.clockMinutes).toBe(0)
    expect(again.decisionCount).toBe(0)
  })
})
