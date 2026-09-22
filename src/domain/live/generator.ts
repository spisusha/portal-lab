/**
 * Генератор «Живой смены».
 *
 * Смена строится не отбраковкой случайных чисел, а по ролям. Сначала пяти
 * порталам раздаются роли — «срочный», «поджимает», «ровный», «спокойный»,
 * «непредсказуемый», — и уже внутри роли разыгрываются показатели. Так
 * состав смены задан по построению: всегда есть один портал, действительно
 * требующий внимания, и всегда есть пара спокойных, на фоне которых видно,
 * что первый именно опасен.
 *
 * Чистая отбраковка («сгенерировать наугад и проверить») давала либо пять
 * одинаково скучных порталов, либо пять горящих — а требование ТЗ прямо
 * противоположное: смена не должна быть ни бессмысленной, ни непроходимой.
 * Проверка всё равно осталась, но как страховка, а не как основной способ.
 *
 * Случайность здесь полностью управляемая: единственный источник разброса —
 * строка seed. `Math.random` и `Date.now` не используются.
 */

import type { LabState, Portal } from '../types'
import { MAX_CYCLES, CYCLE_MINUTES } from '../types'
import { computeRisk } from '../risk'
import { checkAction, MAX_STABILITY } from '../rules'
import { createRandom, type Random } from './prng'
import { normalizeSeed } from './seedCode'
import { TRAIT_IDS, WORLD_TRAITS, traitOf, type WorldTraitId } from './worlds'
import { buildEventSchedule } from './events'
import { pickDirective } from './directives'
import type { LiveShift } from './types'

/** Сколько порталов в живой смене. Ровно столько ролей и описано ниже. */
export const LIVE_PORTAL_COUNT = 5

/** Допустимые границы показателей — генератор не имеет права из них выйти. */
export const LIVE_BOUNDS = {
  energy: { min: 15, max: 90 },
  stability: { min: 20, max: 90 },
  minutes: { min: 45, max: 240 },
  creatures: { min: 0, max: 4 },
} as const

/** Время в смене всегда кратно одному циклу наблюдения. */
export const TIME_STEP = CYCLE_MINUTES

type RoleId = 'urgent' | 'pressing' | 'steady' | 'calm' | 'wild'

interface Role {
  id: RoleId
  energy: [number, number]
  stability: [number, number]
  minutes: [number, number]
  creatures: [number, number]
  /** Строка в историю портала при регистрации — характер роли словами. */
  registered: string
}

/**
 * Роли подобраны так, чтобы ранг по формуле риска попадал в нужную полосу
 * при любом разыгранном значении внутри диапазона: «срочный» — всегда B или A,
 * «спокойный» — всегда E или D. Это проверяется тестом на множестве seed,
 * а не держится на честном слове.
 */
const ROLES: Role[] = [
  {
    id: 'urgent',
    energy: [60, 85],
    stability: [25, 45],
    minutes: [45, 75],
    creatures: [0, 2],
    registered: 'Аварийная регистрация: контур теряет форму, показания скачут.',
  },
  {
    id: 'pressing',
    energy: [45, 70],
    stability: [40, 60],
    minutes: [75, 120],
    creatures: [0, 2],
    registered: 'Портал зарегистрирован. Энергия выше нормы, запас времени средний.',
  },
  {
    id: 'steady',
    energy: [30, 55],
    stability: [60, 80],
    minutes: [105, 210],
    creatures: [0, 2],
    registered: 'Портал зарегистрирован. Контур держится, приборы фиксируют движение.',
  },
  {
    id: 'calm',
    energy: [15, 40],
    stability: [70, 90],
    minutes: [150, 240],
    creatures: [0, 1],
    registered: 'Портал зарегистрирован. Контур штатный, запас времени большой.',
  },
  {
    id: 'wild',
    energy: [30, 80],
    stability: [30, 75],
    minutes: [60, 210],
    creatures: [0, 3],
    registered: 'Портал зарегистрирован. Поведение проёма нестабильно от цикла к циклу.',
  },
]

/** Названия врат. Пул заметно шире пяти, иначе смены слипаются по именам. */
const GATE_NAMES = [
  'Синий обрыв',
  'Стеклянная арка',
  'Ржавый шлюз',
  'Полая звезда',
  'Тихий разлом',
  'Соляной проём',
  'Пепельный зев',
  'Витая скоба',
  'Лунный киль',
  'Медный порог',
  'Хрустальный свод',
  'Долгий выдох',
  'Серая петля',
  'Птичий крик',
  'Последний маяк',
  'Изломанный круг',
  'Немой колодец',
  'Тёплый шов',
]

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

function roll(random: Random, range: [number, number]): number {
  return random.int(range[0], range[1])
}

function rollTime(random: Random, range: [number, number]): number {
  const minutes = random.step(range[0], range[1], TIME_STEP)
  return clamp(minutes, LIVE_BOUNDS.minutes.min, LIVE_BOUNDS.minutes.max)
}

function buildPortals(random: Random): Portal[] {
  // Миры не повторяются: пять разных особенностей в смене — это пять разных
  // поводов выбрать один портал вместо другого. Повтор мира сделал бы
  // половину особенностей невидимой.
  const traits = random.shuffle(TRAIT_IDS).slice(0, LIVE_PORTAL_COUNT)
  const names = random.shuffle(GATE_NAMES).slice(0, LIVE_PORTAL_COUNT)
  const numbers = random.shuffle(
    Array.from({ length: 40 }, (_, index) => index + 1),
  ).slice(0, LIVE_PORTAL_COUNT)
  const roles = random.shuffle(ROLES)

  return roles.map((role, index) => {
    const traitId: WorldTraitId = traits[index]
    const world = WORLD_TRAITS[traitId].world
    const gate = numbers[index]

    const energy = clamp(
      roll(random, role.energy),
      LIVE_BOUNDS.energy.min,
      LIVE_BOUNDS.energy.max,
    )
    const stability = clamp(
      roll(random, role.stability),
      LIVE_BOUNDS.stability.min,
      LIVE_BOUNDS.stability.max,
    )
    const minutesToCollapse = rollTime(random, role.minutes)
    const estimate = clamp(
      roll(random, role.creatures),
      LIVE_BOUNDS.creatures.min,
      LIVE_BOUNDS.creatures.max,
    )
    // Приборы ошибаются не больше чем на одно существо — иначе разведка
    // перестаёт быть уточнением и становится лотереей.
    const actual = clamp(
      estimate + random.int(-1, 1),
      LIVE_BOUNDS.creatures.min,
      LIVE_BOUNDS.creatures.max,
    )

    return {
      id: `lv-${String(gate).padStart(2, '0')}`,
      name: `Врата №${gate} — ${names[index]}`,
      world,
      energy,
      stability,
      minutesToCollapse,
      creaturesInside: estimate,
      creaturesActual: actual,
      creaturesConfirmed: false,
      status: 'OPEN' as const,
      observerInside: false,
      history: [
        {
          atMinutes: 0,
          text: `${role.registered} Особенность мира «${world}»: ${WORLD_TRAITS[traitId].effect}.`,
        },
      ],
      decisionCycle: null,
      decisionAtMinutes: null,
      stabilizedEver: false,
      creaturesLost: 0,
      trait: traitId,
    }
  })
}

/** Переживёт ли портал всю смену, если время до схлопывания не трогать. */
function survivesShift(portal: Portal): boolean {
  const drain = traitOf(portal.trait)?.collapseDrain ?? CYCLE_MINUTES
  return portal.minutesToCollapse > MAX_CYCLES * drain
}

/**
 * Смена, которую не стыдно показать.
 *
 * Роли уже гарантируют разброс рангов, поэтому здесь остались условия,
 * которые ролям не подчиняются: сколько всего существ и сколько порталов
 * доживёт до конца смены. Из-за особенностей миров (топь съедает время
 * вдвое быстрее) второе условие иногда не выполняется, и смену проще
 * перегенерировать с другой солью, чем чинить по частям.
 */
export function shiftIsPlayable(portals: Portal[]): boolean {
  if (portals.length !== LIVE_PORTAL_COUNT) return false
  if (new Set(portals.map((p) => p.id)).size !== LIVE_PORTAL_COUNT) return false
  if (new Set(portals.map((p) => p.world)).size !== LIVE_PORTAL_COUNT) return false

  const ranks = portals.map((portal) => computeRisk(portal).rank)
  // Хотя бы один портал, который действительно требует решения сейчас.
  const demanding = portals.some(
    (portal, index) =>
      ranks[index] === 'A' ||
      ranks[index] === 'S' ||
      ranks[index] === 'B' ||
      portal.minutesToCollapse <= 2 * CYCLE_MINUTES,
  )
  if (!demanding) return false

  // И хотя бы два спокойных — иначе смена выглядит безнадёжной с первой секунды.
  if (ranks.filter((rank) => rank === 'E' || rank === 'D' || rank === 'C').length < 2) {
    return false
  }

  // Существа должны быть, но не всюду: ради них принимают половину решений.
  const creatures = portals.reduce((sum, portal) => sum + portal.creaturesInside, 0)
  if (creatures < 2 || creatures > 8) return false

  // Разведка должна быть доступна хотя бы где-то прямо на старте.
  if (portals.filter((portal) => checkAction(portal, 'SEND_OBSERVER').allowed).length < 2) {
    return false
  }

  // Стабилизировать тоже должно быть что.
  if (portals.filter((portal) => portal.stability < MAX_STABILITY).length < 3) return false

  // И минимум два портала обязаны доживать до конца смены — иначе любая
  // директива про открытые порталы невыполнима, а итог предрешён.
  return portals.filter(survivesShift).length >= 2
}

/** Сколько раз пробовать подобрать смену, прежде чем взять последнюю попытку. */
const MAX_ATTEMPTS = 40

export interface LiveShiftDraft {
  portals: Portal[]
  live: LiveShift
}

/**
 * Порталы, расписание событий и директива для одного seed.
 *
 * Потоков случайности три, и они независимы: у порталов своя соль, у
 * расписания своя, у директивы своя. Благодаря этому добавление ещё одного
 * броска в генератор порталов не сдвигает расписание событий — иначе любая
 * правка генератора ломала бы все ранее сохранённые коды смен.
 */
export function buildLiveShift(rawSeed: string): LiveShiftDraft {
  const seed = normalizeSeed(rawSeed)

  let portals: Portal[] = []
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    portals = buildPortals(createRandom(seed, `portals-${attempt}`))
    if (shiftIsPlayable(portals)) break
  }

  const schedule = buildEventSchedule(
    createRandom(seed, 'events'),
    portals,
    MAX_CYCLES,
  )

  // Директива выбирается последней: её выполнимость проверяется по готовым
  // порталам, а не по намерению генератора.
  const directive = pickDirective(createRandom(seed, 'directive'), { portals })

  return {
    portals,
    live: { seed, directive, schedule, applied: [], timeline: [], science: [] },
  }
}

/** Готовое состояние лаборатории для живой смены по коду. */
export function createLiveShift(rawSeed: string): LabState {
  const { portals, live } = buildLiveShift(rawSeed)

  return {
    portals,
    log: [
      {
        id: 'log-live-start',
        atMinutes: 0,
        portalId: null,
        portalName: null,
        kind: 'system',
        text: `Живая смена ${live.seed} начата. Директива лаборатории: ${live.directive.title.toLowerCase()}.`,
      },
    ],
    clockMinutes: 0,
    scenario: 'live',
    pendingConfirm: null,
    pendingCycleConfirm: null,
    pendingScenario: null,
    pendingSeed: null,
    shiftStatus: 'ACTIVE',
    finishedAtMinutes: null,
    decisionCount: 0,
    observerReturns: 0,
    initialPortalCount: portals.length,
    unresolvedAtEnd: null,
    live,
  }
}
