import { describe, expect, it } from 'vitest'
import { computeRisk, rankForScore } from '../risk'
import { makePortal } from './helpers'

describe('расчёт риска', () => {
  // Тест 1 из чеклиста: риск растёт при падении стабильности.
  it('растёт, когда стабильность падает', () => {
    const stable = makePortal({ stability: 90 })
    const shaky = makePortal({ stability: 20 })

    expect(computeRisk(shaky).score).toBeGreaterThan(computeRisk(stable).score)
  })

  it('складывается ровно из четырёх слагаемых формулы', () => {
    const risk = computeRisk(makePortal())
    const sum = risk.parts.reduce((acc, part) => acc + part.contribution, 0)

    expect(risk.parts).toHaveLength(4)
    expect(risk.score).toBe(Math.round(sum))
  })

  it('не даёт временнóго давления, пока до схлопывания больше горизонта', () => {
    const far = computeRisk(makePortal({ minutesToCollapse: 300 }))
    const timePart = far.parts.find((part) => part.key === 'time')

    expect(timePart?.raw).toBe(0)
  })

  it('размечает ранги по границам шкалы', () => {
    expect(rankForScore(0)).toBe('E')
    expect(rankForScore(15)).toBe('E')
    expect(rankForScore(16)).toBe('D')
    expect(rankForScore(33)).toBe('C')
    expect(rankForScore(51)).toBe('B')
    expect(rankForScore(69)).toBe('A')
    expect(rankForScore(85)).toBe('S')
    expect(rankForScore(100)).toBe('S')
  })

  it('не применяется к закрытому порталу: он не должен попадать в критичные', () => {
    const closed = computeRisk(
      makePortal({ status: 'CLOSED', stability: 5, energy: 99 }),
    )

    expect(closed.applicable).toBe(false)
    expect(closed.score).toBe(0)
  })
})
