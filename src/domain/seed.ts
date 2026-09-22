/**
 * Демо-данные.
 *
 * Три набора вместо одного — чтобы проверяющий увидел все краевые случаи
 * за полминуты, а не доводил лабораторию до них вручную:
 *
 *  - standard — обычная смена, ранги от E до A;
 *  - critical — есть портал ранга S и портал, который схлопнется за один цикл;
 *  - empty    — пустой список порталов.
 *
 * Числа подобраны так, чтобы формула риска дала заранее известные ранги:
 * это позволяет опираться на них в тестах.
 */

import type { LabState, Portal, ScenarioId } from './types'
import { createLiveShift } from './live/generator'

interface PortalDraft {
  id: string
  name: string
  world: string
  energy: number
  stability: number
  minutesToCollapse: number
  /** Показания приборов: сколько существ внутри по оценке. */
  creaturesInside: number
  /** Сколько существ на самом деле — это выясняет наблюдатель. */
  creaturesActual: number
  registered: string
}

function makePortal(draft: PortalDraft): Portal {
  return {
    id: draft.id,
    name: draft.name,
    world: draft.world,
    energy: draft.energy,
    stability: draft.stability,
    minutesToCollapse: draft.minutesToCollapse,
    creaturesInside: draft.creaturesInside,
    creaturesActual: draft.creaturesActual,
    creaturesConfirmed: false,
    status: 'OPEN',
    observerInside: false,
    history: [{ atMinutes: 0, text: draft.registered }],
    decisionCycle: null,
    decisionAtMinutes: null,
    stabilizedEver: false,
    creaturesLost: 0,
  }
}

/** Штатная смена: спокойные порталы и один тяжёлый (ранг A). */
const STANDARD: PortalDraft[] = [
  {
    id: 'p-03',
    name: 'Врата №3 — Тихий разлом',
    world: 'Сумеречная топь',
    energy: 22,
    stability: 88,
    minutesToCollapse: 240,
    creaturesInside: 0,
    creaturesActual: 0,
    registered: 'Портал зарегистрирован. Контур держится штатно.',
  },
  {
    id: 'p-07',
    name: 'Врата №7 — Синий обрыв',
    world: 'Ледяные чертоги',
    energy: 48,
    stability: 64,
    minutesToCollapse: 150,
    creaturesInside: 1,
    creaturesActual: 2,
    registered: 'Портал зарегистрирован. Приборы фиксируют движение внутри.',
  },
  {
    id: 'p-11',
    name: 'Врата №11 — Стеклянная арка',
    world: 'Пустошь Эхо',
    energy: 70,
    stability: 45,
    minutesToCollapse: 90,
    creaturesInside: 2,
    creaturesActual: 3,
    registered: 'Портал зарегистрирован. Энергия выше нормы.',
  },
  {
    id: 'p-02',
    name: 'Врата №2 — Ржавый шлюз',
    world: 'Подземелья Керн',
    energy: 35,
    stability: 72,
    minutesToCollapse: 300,
    creaturesInside: 0,
    creaturesActual: 0,
    registered: 'Портал зарегистрирован. Запас времени большой.',
  },
  {
    id: 'p-19',
    name: 'Врата №19 — Полая звезда',
    world: 'Сад забытых имён',
    energy: 82,
    stability: 30,
    minutesToCollapse: 60,
    creaturesInside: 3,
    creaturesActual: 4,
    registered: 'Портал зарегистрирован. Контур теряет стабильность.',
  },
]

/** Критическая ситуация: ранг S, ранг A и портал на грани схлопывания. */
const CRITICAL: PortalDraft[] = [
  {
    id: 'c-01',
    name: 'Врата №1 — Кровавый разлом',
    world: 'Бездна Аркхан',
    energy: 95,
    stability: 12,
    minutesToCollapse: 30,
    creaturesInside: 4,
    creaturesActual: 5,
    registered: 'Аварийная регистрация. Контур на пределе.',
  },
  {
    id: 'c-05',
    name: 'Врата №5 — Воющая трещина',
    world: 'Пепельные пустоши',
    energy: 88,
    stability: 25,
    minutesToCollapse: 45,
    creaturesInside: 2,
    creaturesActual: 2,
    registered: 'Аварийная регистрация. Слышен гул из проёма.',
  },
  {
    id: 'c-08',
    name: 'Врата №8 — Дрожащий свод',
    world: 'Залы Немой',
    energy: 60,
    stability: 55,
    minutesToCollapse: 120,
    creaturesInside: 1,
    creaturesActual: 0,
    registered: 'Портал зарегистрирован. Показания приборов противоречивы.',
  },
  {
    id: 'c-14',
    name: 'Врата №14 — Последний маяк',
    world: 'Море Сфер',
    energy: 50,
    stability: 40,
    minutesToCollapse: 15,
    creaturesInside: 0,
    creaturesActual: 0,
    registered: 'Портал зарегистрирован. До схлопывания один цикл.',
  },
]

/**
 * Наборы демонстрационных данных. `live` здесь пуст намеренно: живая смена
 * не набор, а генерация по seed, и лежит она в `live/generator.ts`.
 */
const SCENARIO_DRAFTS: Record<ScenarioId, PortalDraft[]> = {
  standard: STANDARD,
  critical: CRITICAL,
  empty: [],
  live: [],
}

/**
 * Состояние на начало смены.
 *
 * `seed` нужен только режиму «Живая смена» и приходит снаружи: домен кодов
 * не придумывает, потому что для этого пришлось бы завести неуправляемый
 * источник случайности. Если код не передан, живой режим открывается с
 * запасным кодом — приложение не должно падать из-за отсутствия параметра.
 */
export function createScenario(scenario: ScenarioId, seed?: string): LabState {
  if (scenario === 'live') {
    return createLiveShift(seed ?? FALLBACK_SEED)
  }
  return {
    portals: SCENARIO_DRAFTS[scenario].map(makePortal),
    log: [],
    clockMinutes: 0,
    scenario,
    pendingConfirm: null,
    pendingCycleConfirm: null,
    pendingScenario: null,
    pendingSeed: null,
    shiftStatus: 'ACTIVE',
    finishedAtMinutes: null,
    decisionCount: 0,
    observerReturns: 0,
    initialPortalCount: SCENARIO_DRAFTS[scenario].length,
    unresolvedAtEnd: null,
    live: null,
  }
}

/**
 * Код на случай, когда живую смену попросили без seed. Такое возможно только
 * при программной ошибке или при ссылке, собранной вручную, — лучше открыть
 * понятную смену, чем показать пустой экран.
 */
export const FALLBACK_SEED = 'PL-LAB2'

/**
 * Состояние, с которого открывается приложение: штатная смена и одна
 * системная строка в журнале, чтобы журнал не выглядел сломанным при старте.
 */
export function createInitialState(): LabState {
  const base = createScenario('standard')
  return {
    ...base,
    log: [
      {
        id: 'log-start',
        atMinutes: 0,
        portalId: null,
        portalName: null,
        kind: 'system',
        text: 'Смена смотрителя начата. Лаборатория под наблюдением.',
      },
    ],
  }
}
