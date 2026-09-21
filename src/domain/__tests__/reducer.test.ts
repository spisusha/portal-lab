import { describe, expect, it } from 'vitest'
import { labReducer } from '../reducer'
import { createScenario } from '../seed'
import { computeRisk } from '../risk'
import type { LabState } from '../types'

const find = (state: LabState, id: string) => {
  const portal = state.portals.find((p) => p.id === id)
  if (!portal) throw new Error(`Портал ${id} не найден в состоянии`)
  return portal
}

describe('переходы состояний лаборатории', () => {
  // Тест 2 из чеклиста: изменение риска после стабилизации.
  it('стабилизация снижает риск и пишет это в историю портала', () => {
    const before = createScenario('standard')
    const riskBefore = computeRisk(find(before, 'p-19')).score

    const after = labReducer(before, { type: 'STABILIZE', portalId: 'p-19' })
    const portal = find(after, 'p-19')
    const riskAfter = computeRisk(portal).score

    expect(riskAfter).toBeLessThan(riskBefore)
    expect(portal.stability).toBe(55)
    expect(portal.energy).toBe(72)
    expect(portal.history.at(-1)?.text).toContain('Стабилизация')
    expect(after.log[0].kind).toBe('action')
  })

  it('не меняет состояние при запрещённом действии, но пишет причину в журнал', () => {
    const state = createScenario('critical')
    // Ранг S — разведка запрещена.
    const after = labReducer(state, { type: 'SEND_OBSERVER', portalId: 'c-01' })

    expect(find(after, 'c-01').observerInside).toBe(false)
    expect(after.log[0].kind).toBe('blocked')
    expect(after.log[0].text).toContain('отклонено')
  })

  // Тест 5 из чеклиста, поведенческая часть: два шага при опасном закрытии.
  it('закрывает портал с существами только после подтверждения', () => {
    const state = createScenario('standard')

    const asked = labReducer(state, { type: 'CLOSE', portalId: 'p-11' })
    expect(asked.pendingConfirm?.portalId).toBe('p-11')
    expect(find(asked, 'p-11').status).toBe('OPEN')

    const closed = labReducer(asked, {
      type: 'CLOSE',
      portalId: 'p-11',
      confirmed: true,
    })
    expect(find(closed, 'p-11').status).toBe('CLOSED')
    expect(closed.pendingConfirm).toBeNull()
    expect(closed.log[0].text).toContain('внутри осталось существ')
  })

  // Тест 6 из чеклиста: ход времени и схлопывание.
  it('цикл уменьшает таймер, а на нуле портал схлопывается', () => {
    const state = createScenario('critical')
    expect(find(state, 'c-14').minutesToCollapse).toBe(15)

    const after = labReducer(state, { type: 'NEXT_CYCLE', confirmed: true })
    const portal = find(after, 'c-14')

    expect(after.clockMinutes).toBe(15)
    expect(portal.minutesToCollapse).toBe(0)
    expect(portal.status).toBe('COLLAPSED')
    expect(after.log.some((entry) => entry.kind === 'critical')).toBe(true)
  })

  it('бездействие повышает риск: за цикл стабильность падает, энергия растёт', () => {
    const state = createScenario('standard')
    const riskBefore = computeRisk(find(state, 'p-07')).score

    const after = labReducer(state, { type: 'NEXT_CYCLE', confirmed: true })
    const portal = find(after, 'p-07')

    expect(portal.stability).toBe(61)
    expect(portal.energy).toBe(50)
    expect(computeRisk(portal).score).toBeGreaterThan(riskBefore)
  })

  it('наблюдатель возвращается через цикл и уточняет число существ', () => {
    const state = createScenario('standard')
    // У «Синего обрыва» приборы показывают 1, на деле существ 2.
    const sent = labReducer(state, { type: 'SEND_OBSERVER', portalId: 'p-07' })
    expect(find(sent, 'p-07').observerInside).toBe(true)
    expect(find(sent, 'p-07').creaturesConfirmed).toBe(false)

    const reported = labReducer(sent, { type: 'NEXT_CYCLE', confirmed: true })
    const portal = find(reported, 'p-07')

    expect(portal.observerInside).toBe(false)
    expect(portal.creaturesConfirmed).toBe(true)
    expect(portal.creaturesInside).toBe(2)
  })

  it('смена сценария полностью сбрасывает лабораторию', () => {
    const dirty = labReducer(createScenario('standard'), {
      type: 'STABILIZE',
      portalId: 'p-19',
    })
    const reset = labReducer(dirty, { type: 'LOAD_SCENARIO', scenario: 'empty', confirmed: true })

    expect(reset.portals).toHaveLength(0)
    expect(reset.clockMinutes).toBe(0)
    expect(reset.log).toHaveLength(2)
    expect(reset.log.every((entry) => entry.kind === 'system' || entry.kind === 'warning')).toBe(true)
  })
})
