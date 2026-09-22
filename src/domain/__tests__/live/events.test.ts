/**
 * События между циклами.
 *
 * Главная проверка здесь — седьмое требование чеклиста: прогноз события
 * совпадает с фактическим результатом следующего цикла. Она формулируется
 * сильнее, чем «тексты похожи»: состояние, которое показал прогноз, должно
 * побайтово совпасть с состоянием после нажатия кнопки.
 */
import { describe, expect, it } from 'vitest'
import {
  EVENT_KINDS,
  EVENT_POWER,
  applyEvent,
  buildEventSchedule,
  calmsDecay,
  describeEvent,
  type ShiftEvent,
} from '../../live/events'
import { createRandom } from '../../live/prng'
import { createLiveShift } from '../../live/generator'
import { buildForecast } from '../../forecast'
import { simulateCycle } from '../../simulate'
import { labReducer } from '../../reducer'
import { createScenario } from '../../seed'
import { MAX_CYCLES, isActive } from '../../types'
import { livePortal, nextCycle, seedSample } from './helpers'

const SEEDS = seedSample(40)

const creatures = (portals: { creaturesInside: number; creaturesActual: number }[]) => ({
  inside: portals.reduce((sum, p) => sum + p.creaturesInside, 0),
  actual: portals.reduce((sum, p) => sum + p.creaturesActual, 0),
})

describe('расписание событий', () => {
  it('задаётся seed и не превышает одного события на переход', () => {
    for (const seed of SEEDS) {
      const state = createLiveShift(seed)
      const schedule = state.live!.schedule
      expect(schedule).toHaveLength(MAX_CYCLES)
      // Каждый слот — либо ровно одно событие, либо тишина.
      for (const slot of schedule) {
        if (slot !== null) expect(EVENT_KINDS).toContain(slot.kind)
      }
      // Первый переход всегда тихий: человеку дают осмотреться.
      expect(schedule[0]).toBeNull()
    }
  })

  it('одинаково строится для одного и того же seed', () => {
    const portals = createLiveShift('PL-7K42').portals
    const first = buildEventSchedule(createRandom('PL-7K42', 'events'), portals, MAX_CYCLES)
    const second = buildEventSchedule(createRandom('PL-7K42', 'events'), portals, MAX_CYCLES)
    expect(second).toEqual(first)
  })

  it('не ставит два одинаковых события подряд', () => {
    for (const seed of SEEDS) {
      const schedule = createLiveShift(seed).live!.schedule
      for (let i = 1; i < schedule.length; i++) {
        if (schedule[i] && schedule[i - 1]) {
          expect(schedule[i]!.kind).not.toBe(schedule[i - 1]!.kind)
        }
      }
    }
  })

  it('встречаются и положительные, и отрицательные, и нейтральные события', () => {
    const tones = new Set<string>()
    for (const seed of seedSample(120)) {
      for (const slot of createLiveShift(seed).live!.schedule) {
        if (slot) tones.add(slot.tone)
      }
    }
    expect(tones).toEqual(new Set(['good', 'bad', 'neutral']))
  })
})

describe('применение событий', () => {
  const pair = [
    livePortal(null, { id: 'a', name: 'А', creaturesInside: 3, creaturesActual: 3 }),
    livePortal(null, { id: 'b', name: 'Б', creaturesInside: 1, creaturesActual: 1 }),
  ]

  const event = (kind: ShiftEvent['kind'], targets: string[], amount?: number): ShiftEvent => ({
    kind,
    title: kind,
    tone: 'neutral',
    targets,
    amount,
  })

  // Требование 8 чеклиста: миграция не меняет общего числа существ.
  it('миграция переносит существ, но не меняет их общее число', () => {
    const before = creatures(pair)
    const after = applyEvent(event('MIGRATION', ['a', 'b'], 2), pair)
    expect(creatures(after.portals)).toEqual(before)
    expect(after.portals[0].creaturesInside).toBe(1)
    expect(after.portals[1].creaturesInside).toBe(3)
    expect(after.notes[0]).toContain('Общее число существ не изменилось')
  })

  it('миграция не может унести больше, чем есть внутри', () => {
    const scarce = [
      livePortal(null, { id: 'a', creaturesInside: 1, creaturesActual: 1 }),
      livePortal(null, { id: 'b', creaturesInside: 0, creaturesActual: 0 }),
    ]
    const after = applyEvent(event('MIGRATION', ['a', 'b'], 2), scarce)
    expect(creatures(after.portals)).toEqual(creatures(scarce))
    expect(after.portals[0].creaturesInside).toBe(0)
    expect(after.portals[1].creaturesInside).toBe(1)
  })

  it('миграция из пустого портала просто не состоится', () => {
    const empty = [
      livePortal(null, { id: 'a', creaturesInside: 0, creaturesActual: 0 }),
      livePortal(null, { id: 'b', creaturesInside: 2, creaturesActual: 2 }),
    ]
    const after = applyEvent(event('MIGRATION', ['a', 'b'], 2), empty)
    expect(after.portals).toEqual(empty)
    expect(after.notes[0]).toContain('не состоялась')
  })

  it('всплеск, просадка и резонанс двигают показатели на объявленную величину', () => {
    const base = [livePortal(null, { id: 'a', energy: 40, stability: 60 })]
    expect(applyEvent(event('ENERGY_SURGE', ['a']), base).portals[0].energy).toBe(
      40 + EVENT_POWER.surgeEnergy,
    )
    expect(applyEvent(event('CIRCUIT_SAG', ['a']), base).portals[0].stability).toBe(
      60 - EVENT_POWER.sagStability,
    )
    expect(applyEvent(event('STABILIZER_BOOST', []), base).portals[0].stability).toBe(
      60 + EVENT_POWER.boostStability,
    )
    const two = [
      livePortal(null, { id: 'a', energy: 40 }),
      livePortal(null, { id: 'b', energy: 50 }),
    ]
    const resonance = applyEvent(event('RESONANCE', ['a', 'b']), two).portals
    expect(resonance[0].energy).toBe(40 + EVENT_POWER.resonanceEnergy)
    expect(resonance[1].energy).toBe(50 + EVENT_POWER.resonanceEnergy)
  })

  it('поверка приборов уточняет оценку и не создаёт новых существ', () => {
    const misread = [livePortal(null, { id: 'a', creaturesInside: 1, creaturesActual: 3 })]
    const after = applyEvent(event('INSTRUMENT_CHECK', ['a']), misread)
    expect(after.portals[0].creaturesInside).toBe(3)
    expect(after.portals[0].creaturesConfirmed).toBe(true)
    expect(after.portals[0].creaturesActual).toBe(3)
  })

  it('не трогает порталы в терминальном статусе', () => {
    const closed = [livePortal(null, { id: 'a', status: 'CLOSED', energy: 40 })]
    const after = applyEvent(event('ENERGY_SURGE', ['a']), closed)
    expect(after.portals).toEqual(closed)
    expect(after.notes[0]).toContain('вне игры')
  })

  it('«Спокойное окно» объявлено отдельно, потому что меняет сам расчёт цикла', () => {
    expect(calmsDecay(event('CALM_WINDOW', []))).toBe(true)
    expect(calmsDecay(event('ENERGY_SURGE', ['a']))).toBe(false)
    expect(calmsDecay(null)).toBe(false)
  })

  it('описание события не выдумывает несуществующих порталов', () => {
    expect(describeEvent(null, pair)).toBeNull()
    expect(describeEvent(event('ENERGY_SURGE', ['a']), pair)).toContain('А')
  })
})

describe('прогноз события совпадает с фактом', () => {
  // Требование 7 чеклиста, в самой сильной формулировке: не «тексты похожи»,
  // а «состояние из прогноза равно состоянию после цикла».
  it('состояние из прогноза равно состоянию после перехода — на всех seed', () => {
    for (const seed of SEEDS) {
      let state = createLiveShift(seed)
      for (let cycle = 0; cycle < MAX_CYCLES && state.shiftStatus !== 'COMPLETE'; cycle++) {
        const promised = simulateCycle(state)
        const forecast = buildForecast(state)
        const next = nextCycle(state)

        for (const portal of next.portals) {
          const expected = promised.portals.find((item) => item.id === portal.id)!
          expect({
            energy: portal.energy,
            stability: portal.stability,
            minutes: portal.minutesToCollapse,
            creatures: portal.creaturesInside,
            confirmed: portal.creaturesConfirmed,
            status: portal.status,
          }).toEqual({
            energy: expected.energy,
            stability: expected.stability,
            minutes: expected.minutesToCollapse,
            creatures: expected.creaturesInside,
            confirmed: expected.creaturesConfirmed,
            status: expected.status,
          })
        }

        // Обещанный текст и записанное в журнал — об одном и том же событии.
        if (forecast.event) {
          expect(forecast.eventText).toBeTruthy()
          expect(next.live!.applied.at(-1)?.event.kind).toBe(forecast.event.kind)
          for (const note of promised.notes) {
            expect(next.log.some((entry) => entry.text === note)).toBe(true)
          }
        }
        state = next
      }
    }
  })

  it('прогноз ошибается ровно настолько, насколько ошибается риск портала', () => {
    let state = createLiveShift('PL-7K42')
    for (let cycle = 0; cycle < 3; cycle++) {
      const forecast = buildForecast(state)
      const next = nextCycle(state)
      for (const outlook of forecast.outlooks) {
        const after = next.portals.find((p) => p.id === outlook.portal.id)!
        if (outlook.collapsing) expect(after.status).toBe('COLLAPSED')
        else expect(isActive(after)).toBe(true)
      }
      state = next
    }
  })

  it('у демо-сценариев событий нет и прогноз остаётся прежним', () => {
    const state = createScenario('standard')
    const forecast = buildForecast(state)
    expect(forecast.event).toBeNull()
    expect(forecast.eventText).toBeNull()
    expect(forecast.headline).toContain('Сильнее всего ухудшится состояние «Врата №19')
    const after = labReducer(state, { type: 'NEXT_CYCLE', confirmed: true })
    expect(after.live ?? null).toBeNull()
  })
})
