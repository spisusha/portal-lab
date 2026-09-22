/**
 * Текст прогноза «Через цикл».
 *
 * Прогноз — единственная строка, по которой человек решает, двигать ли
 * время. Она читается перед каждым переходом шесть раз за смену, поэтому
 * проверяется здесь как текст, а не только как набор чисел: числительные
 * в нужной форме, полные предложения и никаких названий, вшитых в код.
 *
 * Совпадение прогноза с фактом проверяется отдельно — в reducer.test.ts и
 * live/events.test.ts: и прогноз, и переход зовут одну `simulateCycle`.
 */
import { describe, expect, it } from 'vitest'
import { buildForecast } from '../forecast'
import { createScenario } from '../seed'
import type { LabState, Portal } from '../types'
import { makePortal } from './helpers'

function stateWith(portals: Portal[]): LabState {
  return {
    portals,
    log: [],
    clockMinutes: 0,
    scenario: 'standard',
    pendingConfirm: null,
  }
}

describe('прогноз: ни один портал не схлопнется', () => {
  it('называет портал и числа, а не общие слова', () => {
    const forecast = buildForecast(createScenario('standard'))

    expect(forecast.headline).toBe(
      'В следующем цикле ни один портал не схлопнется. Сильнее всего ухудшится ' +
        'состояние «Врата №19 — Полая звезда»: риск 72 → 76.',
    )
    expect(forecast.tone).toBe('warning')
  })

  it('называет именно того, у кого риск вырастет заметнее всех', () => {
    // Второй портал просядет сильнее: стабильность у него падает с того же
    // уровня, но энергии заметно больше.
    const state = stateWith([
      makePortal({ id: 'p1', name: 'Тихие врата', stability: 80, energy: 20, minutesToCollapse: 600 }),
      makePortal({ id: 'p2', name: 'Гулкие врата', stability: 40, energy: 70, minutesToCollapse: 600 }),
    ])
    const forecast = buildForecast(state)

    expect(forecast.worst?.portal.name).toBe('Гулкие врата')
    expect(forecast.headline).toContain('«Гулкие врата»')
    expect(forecast.headline).toContain(
      `риск ${forecast.worst?.riskBefore} → ${forecast.worst?.riskAfter}`,
    )
    expect(forecast.headline).not.toContain('Тихие врата')
  })
})

describe('прогноз: схлопывание', () => {
  it('об одном портале говорит в единственном числе', () => {
    const state = stateWith([
      makePortal({ id: 'p1', name: 'Последний маяк', minutesToCollapse: 10, creaturesInside: 0 }),
      makePortal({ id: 'p2', name: 'Спокойные врата', minutesToCollapse: 600 }),
    ])

    expect(buildForecast(state).headline).toBe(
      'Через 15 мин схлопнется «Последний маяк».',
    )
  })

  it('согласует форму слова «существо» с числом', () => {
    const one = stateWith([
      makePortal({ id: 'p1', name: 'Маяк', minutesToCollapse: 10, creaturesInside: 1 }),
    ])
    const few = stateWith([
      makePortal({ id: 'p1', name: 'Маяк', minutesToCollapse: 10, creaturesInside: 3 }),
    ])
    const many = stateWith([
      makePortal({ id: 'p1', name: 'Маяк', minutesToCollapse: 10, creaturesInside: 11 }),
    ])

    expect(buildForecast(one).headline).toContain('Внутри останется 1 существо.')
    expect(buildForecast(few).headline).toContain('Внутри останется 3 существа.')
    expect(buildForecast(many).headline).toContain('Внутри останется 11 существ.')
  })

  it('о нескольких порталах говорит во множественном и перечисляет их', () => {
    const state = stateWith([
      makePortal({ id: 'p1', name: 'Маяк', minutesToCollapse: 10, creaturesInside: 2 }),
      makePortal({ id: 'p2', name: 'Разлом', minutesToCollapse: 5, creaturesInside: 0 }),
    ])
    const headline = buildForecast(state).headline

    expect(headline).toContain('схлопнется 2 портала: ')
    expect(headline).toContain('«Маяк»')
    expect(headline).toContain('«Разлом»')
    expect(headline).toContain('Внутри останется 2 существа.')
    expect(buildForecast(state).tone).toBe('critical')
  })

  it('пять порталов получают форму «порталов»', () => {
    const state = stateWith(
      [1, 2, 3, 4, 5].map((n) =>
        makePortal({ id: `p${n}`, name: `Врата ${n}`, minutesToCollapse: 5, creaturesInside: 0 }),
      ),
    )

    expect(buildForecast(state).headline).toContain('схлопнется 5 порталов: ')
  })
})

describe('прогноз: край сценария', () => {
  it('пустая лаборатория не обещает событий', () => {
    const forecast = buildForecast(createScenario('empty'))

    expect(forecast.headline).toBe(
      'Открытых порталов нет — следующий цикл пройдёт без событий.',
    )
    expect(forecast.tone).toBe('calm')
  })

  it('портал без изменений описывается полным предложением', () => {
    // Стабильность на полу, энергия на потолке, до схлопывания больше
    // горизонта планирования: цикл не сдвинет ни одного слагаемого риска.
    const state = stateWith([
      makePortal({
        id: 'p1',
        name: 'Заглушенные врата',
        stability: 0,
        energy: 100,
        minutesToCollapse: 600,
      }),
    ])
    const forecast = buildForecast(state)

    expect(forecast.worst).toBeNull()
    expect(forecast.headline).toBe(
      'В следующем цикле ни один портал не схлопнется, и показатели не изменятся: все порталы держатся.',
    )
    expect(forecast.tone).toBe('calm')
  })

  it('после стабилизации прогноз пересчитывается по новым показателям', () => {
    const before = buildForecast(createScenario('standard'))
    const state = createScenario('standard')
    const stabilized: LabState = {
      ...state,
      portals: state.portals.map((portal) =>
        portal.name.includes('Полая звезда')
          ? { ...portal, stability: portal.stability + 25, energy: portal.energy - 10 }
          : portal,
      ),
    }
    const after = buildForecast(stabilized)

    expect(after.headline).not.toBe(before.headline)
    expect(after.outlooks[0].riskAfter).toBeLessThan(before.outlooks[0].riskAfter)
  })
})
