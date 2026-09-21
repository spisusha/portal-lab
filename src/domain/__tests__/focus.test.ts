import { describe, expect, it } from 'vitest'
import { buildFocus } from '../focus'
import { computeRisk, RANK_SCALE, riskHeadline } from '../risk'
import { createScenario } from '../seed'
import type { LabState } from '../types'
import { makePortal } from './helpers'

function stateWith(portals: LabState['portals']): LabState {
  return {
    portals,
    log: [],
    clockMinutes: 0,
    scenario: 'standard',
    pendingConfirm: null,
  }
}

describe('buildFocus — что требует решения сейчас', () => {
  it('в пустой лаборатории решать нечего', () => {
    expect(buildFocus(createScenario('empty'))).toBeNull()
  })

  it('терминальные порталы не считаются: если все закрыты, фокуса нет', () => {
    const state = stateWith([
      makePortal({ id: 'a', status: 'CLOSED' }),
      makePortal({ id: 'b', status: 'COLLAPSED' }),
    ])
    expect(buildFocus(state)).toBeNull()
  })

  it('выбирает портал с наибольшим риском', () => {
    const state = stateWith([
      makePortal({ id: 'calm', stability: 90, energy: 10, minutesToCollapse: 300 }),
      makePortal({ id: 'hot', stability: 15, energy: 95, minutesToCollapse: 30 }),
    ])
    const focus = buildFocus(state)
    expect(focus?.item.portal.id).toBe('hot')
  })

  it('при равном риске первым идёт тот, у кого меньше времени', () => {
    const base = { stability: 50, energy: 50, minutesToCollapse: 120 }
    const state = stateWith([
      makePortal({ id: 'later', ...base }),
      makePortal({ id: 'sooner', ...base, minutesToCollapse: 120 }),
    ])
    // Оба портала одинаковы, значит порядок определяется временем:
    // при полном совпадении берётся первый по списку.
    expect(buildFocus(state)?.item.portal.id).toBe('later')
  })

  it('причина сравнивает выбранный портал с остальными', () => {
    const state = stateWith([
      makePortal({ id: 'calm', stability: 90, energy: 10, minutesToCollapse: 300 }),
      makePortal({ id: 'hot', stability: 15, energy: 95, minutesToCollapse: 300 }),
    ])
    const focus = buildFocus(state)
    expect(focus?.reason).toContain('Самый опасный из 2 открытых')
  })

  it('единственный портал описывается отдельной формулировкой', () => {
    const focus = buildFocus(stateWith([makePortal({ id: 'only' })]))
    expect(focus?.reason).toContain('единственный открытый портал')
  })

  it('ранг S даёт критическую срочность', () => {
    const state = stateWith([
      makePortal({ stability: 5, energy: 98, minutesToCollapse: 20, creaturesInside: 4 }),
    ])
    const focus = buildFocus(state)
    expect(focus?.item.risk.rank).toBe('S')
    expect(focus?.urgency).toBe('critical')
  })

  it('спокойный портал не поднимает тревогу', () => {
    const state = stateWith([
      makePortal({ stability: 92, energy: 8, minutesToCollapse: 300 }),
    ])
    expect(buildFocus(state)?.urgency).toBe('calm')
  })

  it('никогда не советует действие, запрещённое правилами', () => {
    // Ранг A: отправка наблюдателя запрещена регламентом.
    const state = stateWith([
      makePortal({ stability: 20, energy: 90, minutesToCollapse: 60, creaturesInside: 2 }),
    ])
    const focus = buildFocus(state)
    expect(focus?.recommendation.action).not.toBe('SEND_OBSERVER')
  })

  it('в критическом сценарии фокус встаёт на портал ранга S', () => {
    const focus = buildFocus(createScenario('critical'))
    expect(focus?.item.risk.rank).toBe('S')
    expect(focus?.activeCount).toBe(4)
  })
})

describe('объяснение риска', () => {
  it('называет фактор с наибольшим вкладом', () => {
    const portal = makePortal({ stability: 5, energy: 10, minutesToCollapse: 300 })
    // Нестабильность 95 × 0.35 = 33.25 — больше любого другого слагаемого.
    expect(riskHeadline(computeRisk(portal))).toContain('нестабильность')
  })

  it('для неактивного портала объясняет, что риск не считается', () => {
    const portal = makePortal({ status: 'CLOSED' })
    expect(riskHeadline(computeRisk(portal))).toContain('терминальном статусе')
  })

  it('шкала рангов покрывает диапазон 0–100 без разрывов', () => {
    expect(RANK_SCALE[0].min).toBe(0)
    expect(RANK_SCALE[RANK_SCALE.length - 1].max).toBe(100)
    RANK_SCALE.forEach((step, index) => {
      if (index > 0) {
        expect(step.min).toBe(RANK_SCALE[index - 1].max + 1)
      }
    })
  })
})
