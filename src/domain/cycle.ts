/**
 * Что делает с порталом один цикл наблюдения.
 *
 * Вынесено из редьюсера отдельной чистой функцией по одной причине:
 * интерфейс обязан показать прогноз «что будет через цикл» ДО нажатия
 * кнопки. Если бы прогноз считался своей копией формулы, он рано или
 * поздно разошёлся бы с тем, что на самом деле произойдёт. Здесь и
 * редьюсер, и прогноз зовут одну и ту же функцию, поэтому разойтись
 * им нечем.
 *
 * Функция считает только показатели. Журнал и история портала — дело
 * редьюсера: прогноз не должен ничего записывать.
 */

import type { Portal } from './types'
import { CYCLE_MINUTES, isActive } from './types'
import { traitOf } from './live/worlds'

/** За цикл портал теряет 3 пункта стабильности... */
export const NATURAL_STABILITY_DECAY = 3
/** ...и набирает 2 пункта энергии. Бездействие повышает риск. */
export const NATURAL_ENERGY_GROWTH = 2

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/**
 * Насколько сильно один цикл действует на этот конкретный портал.
 *
 * У демонстрационных порталов особенности нет, и все три числа равны
 * базовым — поведение версии 1.0 сохраняется побайтово. В «Живой смене»
 * особенность мира подменяет одно-два из них, и ровно эти числа написаны
 * человеку рядом с названием мира.
 */
export function cyclePressure(portal: Portal): {
  stabilityDecay: number
  energyGrowth: number
  collapseDrain: number
} {
  const trait = traitOf(portal.trait)
  return {
    stabilityDecay: trait?.stabilityDecay ?? NATURAL_STABILITY_DECAY,
    energyGrowth: trait?.energyGrowth ?? NATURAL_ENERGY_GROWTH,
    collapseDrain: trait?.collapseDrain ?? CYCLE_MINUTES,
  }
}

/**
 * Портал через один цикл, если смотритель не вмешается.
 *
 * Порядок ровно тот же, что в смене:
 *  1. наблюдатель возвращается и уточняет число существ;
 *  2. время до схлопывания уменьшается;
 *  3. контур естественно проседает, энергия набирается;
 *  4. на нуле портал схлопывается.
 *
 * `options.calm` — «Спокойное окно» живой смены: единственное событие,
 * которое вмешивается в сам расчёт цикла, а не правит его результат.
 * Поэтому оно передаётся сюда, а не применяется после.
 */
export function projectPortal(
  portal: Portal,
  options: { calm?: boolean } = {},
): Portal {
  if (!isActive(portal)) return portal

  let next = portal

  if (next.observerInside) {
    next = {
      ...next,
      observerInside: false,
      creaturesInside: next.creaturesActual,
      creaturesConfirmed: true,
    }
  }

  const pressure = cyclePressure(portal)
  const decay = options.calm ? 0 : pressure.stabilityDecay
  const minutesToCollapse = Math.max(0, next.minutesToCollapse - pressure.collapseDrain)
  next = {
    ...next,
    minutesToCollapse,
    stability: clamp(next.stability - decay, 0, 100),
    energy: clamp(next.energy + pressure.energyGrowth, 0, 100),
  }

  if (minutesToCollapse === 0) {
    next = { ...next, status: 'COLLAPSED' }
  }

  return next
}
