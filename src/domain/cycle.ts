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

/** За цикл портал теряет 3 пункта стабильности... */
export const NATURAL_STABILITY_DECAY = 3
/** ...и набирает 2 пункта энергии. Бездействие повышает риск. */
export const NATURAL_ENERGY_GROWTH = 2

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/**
 * Портал через один цикл, если смотритель не вмешается.
 *
 * Порядок ровно тот же, что в смене:
 *  1. наблюдатель возвращается и уточняет число существ;
 *  2. время до схлопывания уменьшается;
 *  3. контур естественно проседает, энергия набирается;
 *  4. на нуле портал схлопывается.
 */
export function projectPortal(portal: Portal): Portal {
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

  const minutesToCollapse = Math.max(0, next.minutesToCollapse - CYCLE_MINUTES)
  next = {
    ...next,
    minutesToCollapse,
    stability: clamp(next.stability - NATURAL_STABILITY_DECAY, 0, 100),
    energy: clamp(next.energy + NATURAL_ENERGY_GROWTH, 0, 100),
  }

  if (minutesToCollapse === 0) {
    next = { ...next, status: 'COLLAPSED' }
  }

  return next
}
