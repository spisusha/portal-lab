/**
 * События между циклами «Живой смены».
 *
 * Зачем они нужны: без событий шесть циклов живой смены отличаются от
 * демонстрационной только другими числами на старте. Событие добавляет то,
 * чего в расчёте нет, — повод пересмотреть план на ходу.
 *
 * Чего события делать не должны и не делают:
 *  — падать на голову: расписание задано seed, и следующее событие целиком
 *    показано в блоке «Через цикл» ДО нажатия кнопки;
 *  — отменять решение пользователя: все поправки небольшие и ни одна не
 *    возвращает закрытый портал и не отменяет стабилизацию;
 *  — прятаться: каждое событие пишет строку в журнал смены;
 *  — терять существ: миграция переносит их между порталами, а не создаёт
 *    и не уничтожает.
 *
 * На один переход между циклами приходится не больше одного события.
 */

import type { Portal } from '../types'
import { isActive } from '../types'
import type { Random } from './prng'

export type ShiftEventKind =
  | 'ENERGY_SURGE'
  | 'CIRCUIT_SAG'
  | 'CALM_WINDOW'
  | 'RESONANCE'
  | 'MIGRATION'
  | 'STABILIZER_BOOST'
  | 'INSTRUMENT_CHECK'

/** Положительное, отрицательное или нейтральное — задаёт тон строки в UI. */
export type ShiftEventTone = 'good' | 'bad' | 'neutral'

export interface ShiftEvent {
  kind: ShiftEventKind
  title: string
  tone: ShiftEventTone
  /** Порталы, на которые событие нацелено. Пусто — событие общее. */
  targets: string[]
  /** Сколько существ переносит миграция. Для остальных событий не нужен. */
  amount?: number
}

/** Насколько сильно бьёт каждое событие. Одно место на прогноз и на журнал. */
export const EVENT_POWER = {
  surgeEnergy: 15,
  sagStability: 12,
  resonanceEnergy: 10,
  boostStability: 6,
} as const

const TITLES: Record<ShiftEventKind, string> = {
  ENERGY_SURGE: 'Энергетический всплеск',
  CIRCUIT_SAG: 'Просадка контура',
  CALM_WINDOW: 'Спокойное окно',
  RESONANCE: 'Резонанс двух порталов',
  MIGRATION: 'Миграция существ',
  STABILIZER_BOOST: 'Усиление стабилизаторов',
  INSTRUMENT_CHECK: 'Поверка приборов',
}

const TONES: Record<ShiftEventKind, ShiftEventTone> = {
  ENERGY_SURGE: 'bad',
  CIRCUIT_SAG: 'bad',
  CALM_WINDOW: 'good',
  RESONANCE: 'bad',
  MIGRATION: 'neutral',
  STABILIZER_BOOST: 'good',
  INSTRUMENT_CHECK: 'neutral',
}

/** Сколько целей требует событие: 0 — общее, 1 или 2 — адресное. */
const TARGET_COUNT: Record<ShiftEventKind, number> = {
  ENERGY_SURGE: 1,
  CIRCUIT_SAG: 1,
  CALM_WINDOW: 0,
  RESONANCE: 2,
  MIGRATION: 2,
  STABILIZER_BOOST: 0,
  INSTRUMENT_CHECK: 1,
}

export const EVENT_KINDS: ShiftEventKind[] = Object.keys(TITLES) as ShiftEventKind[]

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/**
 * Расписание на всю смену: по одному слоту на каждый переход между циклами.
 *
 * `null` означает переход без события — тишина тоже должна встречаться,
 * иначе шесть событий подряд превращаются в шум.
 *
 * Расписание строится один раз при создании смены и дальше не меняется:
 * решения пользователя на него не влияют, а значит, повторить смену по тому
 * же seed можно буквально.
 */
export function buildEventSchedule(
  random: Random,
  portals: Portal[],
  transitions: number,
): Array<ShiftEvent | null> {
  const ids = portals.map((portal) => portal.id)
  const schedule: Array<ShiftEvent | null> = []
  // Один и тот же вид не повторяется подряд: две «Просадки контура» рядом
  // читаются как ошибка генератора, а не как сюжет смены.
  let previous: ShiftEventKind | null = null

  for (let index = 0; index < transitions; index++) {
    // Первый переход всегда без события: человек должен успеть разобраться
    // в лаборатории, прежде чем в неё начнут вмешиваться.
    if (index === 0 || !random.chance(0.72)) {
      schedule.push(null)
      previous = null
      continue
    }

    const candidates = EVENT_KINDS.filter((kind) => {
      if (kind === previous) return false
      if (kind === 'MIGRATION' && !portals.some((p) => p.creaturesInside > 0)) {
        return false
      }
      return TARGET_COUNT[kind] <= ids.length
    })

    if (candidates.length === 0) {
      schedule.push(null)
      previous = null
      continue
    }

    const kind = random.pick(candidates)
    const targets =
      kind === 'MIGRATION'
        ? pickMigrationTargets(random, portals)
        : random.shuffle(ids).slice(0, TARGET_COUNT[kind])

    schedule.push({
      kind,
      title: TITLES[kind],
      tone: TONES[kind],
      targets,
      amount: kind === 'MIGRATION' ? random.int(1, 2) : undefined,
    })
    previous = kind
  }

  return schedule
}

/** Источником миграции может быть только портал, внутри которого кто-то есть. */
function pickMigrationTargets(random: Random, portals: Portal[]): string[] {
  const populated = portals.filter((portal) => portal.creaturesInside > 0)
  const from = random.pick(populated)
  const rest = portals.filter((portal) => portal.id !== from.id)
  if (rest.length === 0) return [from.id]
  return [from.id, random.pick(rest).id]
}

/**
 * «Спокойное окно» гасит естественную просадку контура, поэтому оно должно
 * быть известно ДО расчёта цикла, а не после. Остальные события —
 * поправки поверх уже посчитанного цикла.
 */
export function calmsDecay(event: ShiftEvent | null): boolean {
  return event?.kind === 'CALM_WINDOW'
}

export interface EventOutcome {
  portals: Portal[]
  /** Строки для журнала: что именно сделало событие, с числами. */
  notes: string[]
}

/**
 * Применение события к уже посчитанному циклу.
 *
 * Чистая функция: её зовут и редьюсер, и прогноз. Именно поэтому обещание
 * «через цикл у „Врат №7“ энергия +15» не может разойтись с тем, что
 * произойдёт, — это буквально один и тот же вызов.
 */
export function applyEvent(
  event: ShiftEvent | null,
  portals: Portal[],
): EventOutcome {
  if (!event) return { portals, notes: [] }

  const name = (id: string) =>
    portals.find((portal) => portal.id === id)?.name ?? 'портал'
  const live = (id: string) => {
    const portal = portals.find((item) => item.id === id)
    return portal && isActive(portal) ? portal : null
  }

  switch (event.kind) {
    case 'CALM_WINDOW': {
      return {
        portals,
        notes: ['Спокойное окно: за этот цикл контуры не просели.'],
      }
    }

    case 'ENERGY_SURGE': {
      const target = live(event.targets[0])
      if (!target) return { portals, notes: [missed(event, name(event.targets[0]))] }
      const before = target.energy
      const after = clamp(before + EVENT_POWER.surgeEnergy, 0, 100)
      return {
        portals: withPortal(portals, target.id, (portal) => ({ ...portal, energy: after })),
        notes: [`Энергетический всплеск в «${target.name}»: энергия ${before} → ${after}.`],
      }
    }

    case 'CIRCUIT_SAG': {
      const target = live(event.targets[0])
      if (!target) return { portals, notes: [missed(event, name(event.targets[0]))] }
      const before = target.stability
      const after = clamp(before - EVENT_POWER.sagStability, 0, 100)
      return {
        portals: withPortal(portals, target.id, (portal) => ({ ...portal, stability: after })),
        notes: [`Просадка контура в «${target.name}»: стабильность ${before} → ${after}.`],
      }
    }

    case 'RESONANCE': {
      const pair = event.targets
        .map(live)
        .filter((portal): portal is Portal => portal !== null)
      if (pair.length < 2) {
        return { portals, notes: [missed(event, event.targets.map(name).join(' и '))] }
      }
      let next = portals
      for (const portal of pair) {
        next = withPortal(next, portal.id, (item) => ({
          ...item,
          energy: clamp(item.energy + EVENT_POWER.resonanceEnergy, 0, 100),
        }))
      }
      return {
        portals: next,
        notes: [
          `Резонанс «${pair[0].name}» и «${pair[1].name}»: у обоих энергия +${EVENT_POWER.resonanceEnergy}.`,
        ],
      }
    }

    case 'STABILIZER_BOOST': {
      const touched = portals.filter(isActive)
      if (touched.length === 0) {
        return {
          portals,
          notes: ['Усиление стабилизаторов прошло впустую: активных порталов нет.'],
        }
      }
      const next = portals.map((portal) =>
        isActive(portal)
          ? {
              ...portal,
              stability: clamp(portal.stability + EVENT_POWER.boostStability, 0, 100),
            }
          : portal,
      )
      return {
        portals: next,
        notes: [
          `Усиление стабилизаторов: у всех открытых порталов стабильность +${EVENT_POWER.boostStability} (порталов: ${touched.length}).`,
        ],
      }
    }

    case 'INSTRUMENT_CHECK': {
      const target = live(event.targets[0])
      if (!target) return { portals, notes: [missed(event, name(event.targets[0]))] }
      if (target.creaturesConfirmed) {
        return {
          portals,
          notes: [
            `Поверка приборов в «${target.name}»: число существ уже подтверждено, ${target.creaturesInside}.`,
          ],
        }
      }
      return {
        portals: withPortal(portals, target.id, (portal) => ({
          ...portal,
          creaturesInside: portal.creaturesActual,
          creaturesConfirmed: true,
        })),
        notes: [
          `Поверка приборов в «${target.name}»: оценка ≈${target.creaturesInside} уточнена до ${target.creaturesActual} без наблюдателя.`,
        ],
      }
    }

    case 'MIGRATION': {
      const from = live(event.targets[0])
      const to = live(event.targets[1])
      if (!from || !to || from.id === to.id) {
        return { portals, notes: [missed(event, event.targets.map(name).join(' → '))] }
      }
      // Переносится не больше, чем реально есть: и по показаниям приборов,
      // и по факту. Иначе общее число существ изменилось бы.
      const moved = Math.min(
        event.amount ?? 1,
        from.creaturesInside,
        from.creaturesActual,
      )
      if (moved <= 0) {
        return {
          portals,
          notes: [`Миграция из «${from.name}» не состоялась: внутри никого нет.`],
        }
      }
      let next = withPortal(portals, from.id, (portal) => ({
        ...portal,
        creaturesInside: portal.creaturesInside - moved,
        creaturesActual: portal.creaturesActual - moved,
      }))
      next = withPortal(next, to.id, (portal) => ({
        ...portal,
        creaturesInside: portal.creaturesInside + moved,
        creaturesActual: portal.creaturesActual + moved,
        // Число у принимающего портала снова становится оценкой: приборы
        // не успевают пересчитать пополнение.
        creaturesConfirmed: false,
      }))
      return {
        portals: next,
        notes: [
          `Миграция существ: ${moved} из «${from.name}» перешли в «${to.name}». Общее число существ не изменилось.`,
        ],
      }
    }
  }
}

function missed(event: ShiftEvent, where: string): string {
  return `${event.title}: цель события («${where}») уже вне игры, изменений нет.`
}

function withPortal(
  portals: Portal[],
  id: string,
  update: (portal: Portal) => Portal,
): Portal[] {
  return portals.map((portal) => (portal.id === id ? update(portal) : portal))
}

/**
 * Что будет написано в блоке «Через цикл» до нажатия кнопки.
 *
 * Текст строится по тому же состоянию, по которому событие будет применено,
 * поэтому обещание совпадает с делом вплоть до имён порталов.
 */
export function describeEvent(
  event: ShiftEvent | null,
  portals: Portal[],
): string | null {
  if (!event) return null
  const name = (id: string) =>
    portals.find((item) => item.id === id)?.name ?? 'неизвестный портал'

  switch (event.kind) {
    case 'CALM_WINDOW':
      return 'Спокойное окно: за этот переход контуры не просядут.'
    case 'ENERGY_SURGE':
      return `Энергетический всплеск в «${name(event.targets[0])}»: энергия +${EVENT_POWER.surgeEnergy}.`
    case 'CIRCUIT_SAG':
      return `Просадка контура в «${name(event.targets[0])}»: стабильность −${EVENT_POWER.sagStability}.`
    case 'RESONANCE':
      return `Резонанс «${name(event.targets[0])}» и «${name(event.targets[1])}»: у обоих энергия +${EVENT_POWER.resonanceEnergy}.`
    case 'STABILIZER_BOOST':
      return `Усиление стабилизаторов: у всех открытых порталов стабильность +${EVENT_POWER.boostStability}.`
    case 'INSTRUMENT_CHECK':
      return `Поверка приборов в «${name(event.targets[0])}»: число существ будет уточнено без наблюдателя.`
    case 'MIGRATION':
      return `Миграция существ: до ${event.amount ?? 1} из «${name(event.targets[0])}» перейдут в «${name(event.targets[1])}». Общее число существ не изменится.`
  }
}
