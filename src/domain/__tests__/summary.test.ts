import { describe, expect, it } from 'vitest'
import { buildSummary } from '../summary'
import { labReducer } from '../reducer'
import { createScenario } from '../seed'

describe('итоговая сводка', () => {
  // Тест 7 из чеклиста: счётчики сводки.
  it('считает открытые, критичные и закрытые порталы', () => {
    const state = createScenario('standard')
    const summary = buildSummary(state)

    expect(summary.total).toBe(5)
    expect(summary.active).toBe(5)
    expect(summary.closed).toBe(0)
    // Ранга A в штатном наборе достигает только «Полая звезда».
    expect(summary.critical).toBe(1)
    expect(summary.creaturesInside).toBe(6)
  })

  it('сортирует блок «требуют внимания» по убыванию риска', () => {
    const summary = buildSummary(createScenario('standard'))
    const ids = summary.attention.map((item) => item.portal.id)

    expect(ids).toEqual(['p-19', 'p-11', 'p-07'])
    expect(summary.attention[0].risk.rank).toBe('A')
  })

  it('исключает закрытые порталы из активных и из блока внимания', () => {
    const state = createScenario('standard')
    const closed = labReducer(
      labReducer(state, { type: 'CLOSE', portalId: 'p-19' }),
      { type: 'CLOSE', portalId: 'p-19', confirmed: true },
    )
    const summary = buildSummary(closed)

    expect(summary.closed).toBe(1)
    expect(summary.active).toBe(4)
    expect(summary.critical).toBe(0)
    expect(summary.attention.map((item) => item.portal.id)).not.toContain('p-19')
  })

  it('корректно работает на пустой лаборатории', () => {
    const summary = buildSummary(createScenario('empty'))

    expect(summary.total).toBe(0)
    expect(summary.active).toBe(0)
    expect(summary.critical).toBe(0)
    expect(summary.attention).toEqual([])
  })
})
