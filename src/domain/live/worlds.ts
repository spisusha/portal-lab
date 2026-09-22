/**
 * Особенности девяти миров.
 *
 * До версии 1.1 мир был только картинкой и названием: выбирая между двумя
 * порталами с одинаковыми цифрами, человек не имел ни одной причины
 * предпочесть один другому. Особенность делает мир аргументом в решении —
 * ледяной контур стоит стабилизировать раньше, потому что дальше он хуже
 * принимает стабилизацию, а топь стоит закрывать раньше, потому что время
 * там уходит вдвое быстрее.
 *
 * Правила, которых особенности обязаны держаться:
 *  — у каждого мира ровно одна основная особенность;
 *  — она описана одной строкой, которая видна рядом с названием мира
 *    ДО принятия решения (`effect`);
 *  — все числа отсюда попадают в прогноз и журнал, скрытых поправок нет;
 *  — особенности применяются только в «Живой смене»: у порталов трёх
 *    демонстрационных сценариев поле `trait` пустое, и все формулы
 *    работают ровно как в версии 1.0.
 *
 * Модуль намеренно ничего не импортирует. Базовые величины (шаг
 * стабилизации, естественный распад) остаются в `rules.ts` и `cycle.ts`,
 * а здесь лежат только поправки к ним — иначе получилась бы кольцевая
 * зависимость, и особенности стало бы невозможно читать в одном месте.
 */

export type WorldTraitId =
  | 'marsh-drag'
  | 'frost-circuit'
  | 'echo-resonance'
  | 'stone-vault'
  | 'quiet-garden'
  | 'abyss-rift'
  | 'ash-plume'
  | 'silent-halls'
  | 'sphere-floats'

export interface WorldTrait {
  id: WorldTraitId
  /** Мир, которому принадлежит особенность. */
  world: string
  /** Название особенности — короткое, как имя явления. */
  title: string
  /** Одна строка рядом с названием мира. Это обещание интерфейса. */
  effect: string
  /** Сколько пунктов стабильности мир теряет за цикл. */
  stabilityDecay?: number
  /** Сколько пунктов энергии мир набирает за цикл. */
  energyGrowth?: number
  /** Сколько минут до схлопывания уходит за цикл. Кратно 15. */
  collapseDrain?: number
  /** Насколько стабилизация поднимает стабильность. */
  stabilizeStep?: number
  /** Насколько стабилизация гасит энергию. */
  stabilizeEnergyDrop?: number
  /** Множитель научных данных, которые даёт портал этого мира. */
  scienceFactor?: number
}

export const WORLD_TRAITS: Record<WorldTraitId, WorldTrait> = {
  'marsh-drag': {
    id: 'marsh-drag',
    world: 'Сумеречная топь',
    title: 'Топь тянет вниз',
    effect: 'время до схлопывания уходит вдвое быстрее: −30 мин за цикл вместо −15',
    collapseDrain: 30,
  },

  'frost-circuit': {
    id: 'frost-circuit',
    world: 'Ледяные чертоги',
    title: 'Морозный контур',
    effect: 'контур проседает медленнее (−1 за цикл), но стабилизация даёт только +15',
    stabilityDecay: 1,
    stabilizeStep: 15,
  },

  'echo-resonance': {
    id: 'echo-resonance',
    world: 'Пустошь Эхо',
    title: 'Эхо резонанса',
    effect: 'энергия набирается быстрее: +5 за цикл вместо +2',
    energyGrowth: 5,
  },

  'stone-vault': {
    id: 'stone-vault',
    world: 'Подземелья Керн',
    title: 'Каменный свод',
    effect: 'энергия сама не растёт, но и стабилизация её не гасит',
    energyGrowth: 0,
    stabilizeEnergyDrop: 0,
  },

  'quiet-garden': {
    id: 'quiet-garden',
    world: 'Сад забытых имён',
    title: 'Тихий сад',
    effect: 'стабилизация даёт +35 вместо +25, но научных данных вдвое меньше',
    stabilizeStep: 35,
    scienceFactor: 0.5,
  },

  'abyss-rift': {
    id: 'abyss-rift',
    world: 'Бездна Аркхан',
    title: 'Разлом Аркхан',
    effect: 'контур проседает вдвое быстрее (−6 за цикл), зато научных данных вдвое больше',
    stabilityDecay: 6,
    scienceFactor: 2,
  },

  'ash-plume': {
    id: 'ash-plume',
    world: 'Пепельные пустоши',
    title: 'Пепельный шлейф',
    effect: 'энергия растёт быстрее (+4 за цикл), но стабилизация гасит её сильнее: −20',
    energyGrowth: 4,
    stabilizeEnergyDrop: 20,
  },

  'silent-halls': {
    id: 'silent-halls',
    world: 'Залы Немой',
    title: 'Немая тишина',
    effect: 'контур не проседает сам (−0 за цикл), но энергия набирается быстрее: +4',
    stabilityDecay: 0,
    energyGrowth: 4,
  },

  'sphere-floats': {
    id: 'sphere-floats',
    world: 'Море Сфер',
    title: 'Сферы-поплавки',
    effect: 'наблюдения дают в полтора раза больше научных данных, но стабилизация даёт лишь +20',
    stabilizeStep: 20,
    scienceFactor: 1.5,
  },
}

/** Порядок миров в генераторе. Фиксированный, чтобы seed был воспроизводим. */
export const TRAIT_IDS: WorldTraitId[] = Object.keys(WORLD_TRAITS) as WorldTraitId[]

/** Особенность по идентификатору. Пусто — значит демо-сценарий, поправок нет. */
export function traitOf(
  id: WorldTraitId | null | undefined,
): WorldTrait | null {
  if (!id) return null
  return WORLD_TRAITS[id] ?? null
}

/** Особенность по названию мира — нужна интерфейсу и генератору. */
export function traitForWorld(world: string): WorldTrait | null {
  return TRAIT_IDS.map((id) => WORLD_TRAITS[id]).find((t) => t.world === world) ?? null
}

/** Множитель научных данных. Отсутствие особенности — обычный мир, ×1. */
export function scienceFactorOf(id: WorldTraitId | null | undefined): number {
  return traitOf(id)?.scienceFactor ?? 1
}
