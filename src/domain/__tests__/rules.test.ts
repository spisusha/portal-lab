import { describe, expect, it } from 'vitest'
import { checkAction, MAX_STABILITY } from '../rules'
import { computeRisk } from '../risk'
import { makePortal } from './helpers'

describe('правила действий', () => {
  // Тест 3 из чеклиста: нельзя стабилизировать закрытый портал.
  it('запрещает любое действие над закрытым порталом и объясняет почему', () => {
    const closed = makePortal({ status: 'CLOSED' })
    const check = checkAction(closed, 'STABILIZE')

    expect(check.allowed).toBe(false)
    expect(check.reason).toContain('закрыт')
  })

  it('запрещает действия над схлопнувшимся порталом', () => {
    const collapsed = makePortal({ status: 'COLLAPSED' })

    expect(checkAction(collapsed, 'CLOSE').allowed).toBe(false)
    expect(checkAction(collapsed, 'SEND_OBSERVER').allowed).toBe(false)
  })

  // Тест 4 из чеклиста: нельзя отправить наблюдателя при критическом ранге.
  it('запрещает разведку при критическом ранге', () => {
    const deadly = makePortal({
      stability: 12,
      energy: 95,
      minutesToCollapse: 30,
      creaturesInside: 4,
    })
    const risk = computeRisk(deadly)
    const check = checkAction(deadly, 'SEND_OBSERVER')

    expect(risk.rank).toBe('S')
    expect(check.allowed).toBe(false)
    expect(check.reason).toContain('запрещена регламентом')
  })

  it('разрешает разведку при умеренном риске', () => {
    const calm = makePortal({ stability: 80, energy: 30, minutesToCollapse: 240 })

    expect(checkAction(calm, 'SEND_OBSERVER').allowed).toBe(true)
  })

  it('не даёт отправить второго наблюдателя, пока первый внутри', () => {
    const busy = makePortal({ observerInside: true })
    const check = checkAction(busy, 'SEND_OBSERVER')

    expect(check.allowed).toBe(false)
    expect(check.reason).toContain('уже внутри')
  })

  it('не стабилизирует портал, который уже на пределе контура', () => {
    const maxed = makePortal({ stability: MAX_STABILITY })
    const check = checkAction(maxed, 'STABILIZE')

    expect(check.allowed).toBe(false)
    expect(check.reason).toContain('предел')
  })

  // Тест 5 из чеклиста: закрытие портала с существами требует подтверждения.
  it('требует подтверждения при закрытии портала с существами внутри', () => {
    const populated = makePortal({ creaturesInside: 3 })
    const check = checkAction(populated, 'CLOSE')

    expect(check.allowed).toBe(true)
    expect(check.requiresConfirm).toBe(true)
    expect(check.confirmQuestion).toContain('существ')
  })

  it('закрывает пустой портал без лишних вопросов', () => {
    const empty = makePortal({ creaturesInside: 0 })
    const check = checkAction(empty, 'CLOSE')

    expect(check.allowed).toBe(true)
    expect(check.requiresConfirm).toBeUndefined()
  })
})
