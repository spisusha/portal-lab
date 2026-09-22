import type { LabState, Portal } from '../../types'
import type { WorldTraitId } from '../../live/worlds'
import { labReducer } from '../../reducer'

/** Портал с особенностью мира — основа тестов живого режима. */
export function livePortal(
  trait: WorldTraitId | null,
  overrides: Partial<Portal> = {},
): Portal {
  return {
    id: 'lv-01',
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
    decisionCycle: null,
    decisionAtMinutes: null,
    stabilizedEver: false,
    creaturesLost: 0,
    trait,
    ...overrides,
  }
}

/** Набор разных кодов смен — тесты не должны держаться на одном seed. */
export function seedSample(count = 60): string[] {
  const alphabet = '234679ACDEFGHJKLMNPQRTUVWXYZ'
  const seeds: string[] = []
  for (let i = 0; i < count; i++) {
    let n = (i + 1) * 7919
    const body = [0, 1, 2, 3]
      .map(() => {
        const char = alphabet[n % alphabet.length]
        n = Math.floor(n / alphabet.length) + i * 31 + 1
        return char
      })
      .join('')
    seeds.push(`PL-${body}`)
  }
  return [...new Set(seeds)]
}

export const nextCycle = (state: LabState): LabState =>
  labReducer(state, { type: 'NEXT_CYCLE', confirmed: true })

export const portalById = (state: LabState, id: string): Portal => {
  const portal = state.portals.find((item) => item.id === id)
  if (!portal) throw new Error(`Портал ${id} не найден`)
  return portal
}
