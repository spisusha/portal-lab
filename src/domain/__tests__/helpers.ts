import type { Portal } from '../types'

/** Базовый портал для тестов: спокойный, без существ внутри. */
export function makePortal(overrides: Partial<Portal> = {}): Portal {
  return {
    id: 'test-1',
    name: 'Тестовые врата',
    world: 'Тестовый мир',
    energy: 40,
    stability: 70,
    minutesToCollapse: 200,
    creaturesInside: 0,
    creaturesActual: 0,
    creaturesConfirmed: false,
    status: 'OPEN',
    observerInside: false,
    history: [],
    ...overrides,
  }
}
