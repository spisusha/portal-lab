import { describe, expect, it } from 'vitest'
import { buildShiftSummary, buildSummary } from '../summary'
import { labReducer } from '../reducer'
import { createScenario } from '../seed'
import { checkAction } from '../rules'
import { currentCycle, isActive } from '../types'

const portal = (state: ReturnType<typeof createScenario>, id: string) => {
  const value = state.portals.find((item) => item.id === id)
  if (!value) throw new Error(`Missing portal ${id}`)
  return value
}

const confirmCycle = (state: ReturnType<typeof createScenario>) =>
  labReducer(state, { type: 'NEXT_CYCLE', confirmed: true })

describe('конечная смена и одно решение за цикл', () => {
  it('запрещает повторную стабилизацию в одном цикле', () => {
    const once = labReducer(createScenario('standard'), { type: 'STABILIZE', portalId: 'p-19' })
    const twice = labReducer(once, { type: 'STABILIZE', portalId: 'p-19' })
    expect(portal(twice, 'p-19').stability).toBe(55)
    expect(twice.log[0].kind).toBe('blocked')
  })

  it('не применяет повторное действие дважды', () => {
    const initial = createScenario('standard')
    const first = labReducer(initial, { type: 'STABILIZE', portalId: 'p-19' })
    const second = labReducer(first, { type: 'STABILIZE', portalId: 'p-19' })
    expect(second.decisionCount).toBe(1)
    expect(second.log.filter((entry) => entry.kind === 'action')).toHaveLength(1)
  })

  it('возвращает понятную причину и блокирует все действия после решения', () => {
    const state = labReducer(createScenario('standard'), { type: 'STABILIZE', portalId: 'p-19' })
    const current = currentCycle(state)
    for (const kind of ['STABILIZE', 'SEND_OBSERVER', 'MARK_QUESTIONED', 'CLOSE'] as const) {
      const check = checkAction(portal(state, 'p-19'), kind, current)
      expect(check.allowed).toBe(false)
      expect(check.reason).toContain('Решение по этому порталу уже принято')
    }
  })

  it('сбрасывает отметку решения на следующем цикле', () => {
    const state = confirmCycle(labReducer(createScenario('standard'), { type: 'STABILIZE', portalId: 'p-19' }))
    expect(portal(state, 'p-19').decisionCycle).toBeNull()
    expect(checkAction(portal(state, 'p-19'), 'STABILIZE', currentCycle(state)).allowed).toBe(true)
  })

  it('после решения следующий необработанный портал остаётся доступным', () => {
    const state = labReducer(createScenario('standard'), { type: 'STABILIZE', portalId: 'p-19' })
    const open = state.portals.filter(isActive)
    expect(open.filter((item) => item.decisionCycle !== currentCycle(state))).toHaveLength(4)
  })

  it('требует подтверждение перехода с необработанными порталами', () => {
    const state = labReducer(createScenario('standard'), { type: 'NEXT_CYCLE' })
    expect(state.pendingConfirm?.action).toBe('NEXT_CYCLE')
    expect(state.pendingConfirm?.question).toContain('решение не принято')
  })

  it('уменьшает очередь после схлопывания', () => {
    const state = confirmCycle(createScenario('critical'))
    expect(buildSummary(state).active).toBe(3)
    expect(buildSummary(state).collapsed).toBe(1)
  })

  it('уменьшает очередь после подтверждённого закрытия', () => {
    const asked = labReducer(createScenario('standard'), { type: 'CLOSE', portalId: 'p-19' })
    const closed = labReducer(asked, { type: 'CLOSE', portalId: 'p-19', confirmed: true })
    expect(buildSummary(closed).active).toBe(4)
    expect(buildSummary(closed).closed).toBe(1)
  })

  it('пересчитывает все счётчики из текущего состояния', () => {
    const asked = labReducer(createScenario('standard'), { type: 'CLOSE', portalId: 'p-19' })
    const state = labReducer(asked, { type: 'CLOSE', portalId: 'p-19', confirmed: true })
    const summary = buildSummary(state)
    expect({ open: summary.open, closed: summary.closed, active: summary.active, creatures: summary.creaturesInside }).toEqual({ open: 4, closed: 1, active: 4, creatures: 3 })
  })

  it('завершает смену после шестого цикла', () => {
    let state = createScenario('standard')
    for (let i = 0; i < 6; i++) state = confirmCycle(state)
    expect(state.shiftStatus).toBe('COMPLETE')
    expect(state.clockMinutes).toBe(90)
  })

  it('завершает смену досрочно, когда открытых порталов не осталось', () => {
    let state = createScenario('empty')
    expect(state.shiftStatus).toBe('ACTIVE')
    state = labReducer(state, { type: 'NEXT_CYCLE', confirmed: true })
    expect(state.shiftStatus).toBe('COMPLETE')
  })

  it('считает безопасных, опасных и потерянных существ', () => {
    const asked = labReducer(createScenario('standard'), { type: 'CLOSE', portalId: 'p-19' })
    const state = labReducer(asked, { type: 'CLOSE', portalId: 'p-19', confirmed: true })
    const summary = buildShiftSummary(state)
    expect(summary.lostCreatures).toBe(3)
    expect(summary.safeCreatures).toBe(3)
  })

  it('выбирает оценку смены по заданным правилам', () => {
    let excellent = createScenario('empty')
    excellent = labReducer(excellent, { type: 'NEXT_CYCLE', confirmed: true })
    expect(buildShiftSummary(excellent).outcome).toBe('excellent')

    let losses = confirmCycle(createScenario('critical'))
    expect(buildShiftSummary(losses).outcome).toBe('losses')
  })

  it('не оставляет действий после завершения смены', () => {
    let state = createScenario('standard')
    for (let i = 0; i < 6; i++) state = confirmCycle(state)
    const next = labReducer(state, { type: 'STABILIZE', portalId: 'p-19' })
    expect(next.portals).toEqual(state.portals)
    expect(next.log[0].kind).toBe('blocked')
  })

  it('полностью сбрасывает состояние при перезапуске сценария', () => {
    const dirty = labReducer(createScenario('standard'), { type: 'STABILIZE', portalId: 'p-19' })
    const reset = labReducer(dirty, { type: 'LOAD_SCENARIO', scenario: 'standard', confirmed: true })
    expect(reset.clockMinutes).toBe(0)
    expect(reset.decisionCount).toBe(0)
    expect(portal(reset, 'p-19').stability).toBe(30)
  })

  it('требует подтверждение смены демо-сценария после прогресса', () => {
    const dirty = labReducer(createScenario('standard'), { type: 'STABILIZE', portalId: 'p-19' })
    const next = labReducer(dirty, { type: 'LOAD_SCENARIO', scenario: 'critical' })
    expect(next.pendingConfirm?.action).toBe('LOAD_SCENARIO')
    expect(next.pendingScenario).toBe('critical')
  })
})
