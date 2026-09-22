/**
 * Директива смены — одна дополнительная задача лаборатории.
 *
 * Главная цель живой смены прежняя: сохранить порталы, не допустить аварий
 * и уберечь существ. Директива её не заменяет, а добавляет второй критерий,
 * из-за которого одинаковые по риску решения перестают быть равноценными:
 * «вернуть двух наблюдателей» делает разведку ценной там, где без директивы
 * достаточно было бы просто стабилизировать и забыть.
 *
 * Три правила, за которыми следит этот модуль:
 *  1. Директива выбирается по seed и не меняется в течение смены.
 *  2. В начальном состоянии она обязана быть выполнимой — за это отвечает
 *     `directiveFeasible`, и генератор не отдаёт смену, пока это не так.
 *  3. Невыполнение директивы не объявляет смену проваленной: в итоге это
 *     один блок из четырёх, и его вес намеренно самый маленький.
 */

import type { LabState, Portal } from '../types'
import { MAX_CYCLES, CYCLE_MINUTES, isActive } from '../types'
import { computeRisk } from '../risk'
import { checkAction, MAX_STABILITY } from '../rules'
import { traitOf } from './worlds'
import type { Random } from './prng'

export type DirectiveId =
  | 'NO_COLLAPSE'
  | 'NO_LOSSES'
  | 'OBSERVERS'
  | 'KEEP_OPEN'
  | 'NO_CRITICAL'
  | 'STABILIZE_THREE'

export interface Directive {
  id: DirectiveId
  /** Формулировка приказа — то, что видно рядом с прогрессом смены. */
  title: string
  /** Как именно он проверяется. Условие не должно быть загадкой. */
  rule: string
  /** Сколько единиц требуется, если директива числовая. */
  target: number
}

/** Сколько порталов нужно удержать открытыми по директиве KEEP_OPEN. */
export const KEEP_OPEN_TARGET = 3
/** Сколько наблюдателей нужно вернуть по директиве OBSERVERS. */
export const OBSERVERS_TARGET = 2
/** Сколько разных порталов нужно стабилизировать по директиве STABILIZE_THREE. */
export const STABILIZE_TARGET = 3

export const DIRECTIVES: Record<DirectiveId, Directive> = {
  NO_COLLAPSE: {
    id: 'NO_COLLAPSE',
    title: 'Не допустить ни одного схлопывания',
    rule: 'к концу смены ни один портал не должен схлопнуться; управляемое закрытие схлопыванием не считается',
    target: 0,
  },
  NO_LOSSES: {
    id: 'NO_LOSSES',
    title: 'Завершить смену без потери существ',
    rule: 'ни одно существо не должно остаться в закрытом или схлопнувшемся портале',
    target: 0,
  },
  OBSERVERS: {
    id: 'OBSERVERS',
    title: `Вернуть минимум ${OBSERVERS_TARGET} наблюдателей`,
    rule: 'наблюдатель засчитывается, когда он вернулся с отчётом, а не когда отправлен',
    target: OBSERVERS_TARGET,
  },
  KEEP_OPEN: {
    id: 'KEEP_OPEN',
    title: `Сохранить открытыми минимум ${KEEP_OPEN_TARGET} портала`,
    rule: 'считаются порталы, оставшиеся активными к концу смены — открытые и под вопросом',
    target: KEEP_OPEN_TARGET,
  },
  NO_CRITICAL: {
    id: 'NO_CRITICAL',
    title: 'Завершить смену без критических порталов',
    rule: 'к концу смены среди активных порталов не должно остаться ранга S',
    target: 0,
  },
  STABILIZE_THREE: {
    id: 'STABILIZE_THREE',
    title: `Стабилизировать минимум ${STABILIZE_TARGET} разных портала`,
    rule: 'считается каждый портал, стабилизированный хотя бы один раз за смену',
    target: STABILIZE_TARGET,
  },
}

export const DIRECTIVE_IDS: DirectiveId[] = Object.keys(DIRECTIVES) as DirectiveId[]

/** Сколько минут до схлопывания уходит у этого портала за один цикл. */
function drainOf(portal: Portal): number {
  return traitOf(portal.trait)?.collapseDrain ?? CYCLE_MINUTES
}

/** Переживёт ли портал всю смену, если время до схлопывания не трогать. */
function survivesShift(portal: Portal): boolean {
  return portal.minutesToCollapse > MAX_CYCLES * drainOf(portal)
}

/**
 * Выполнима ли директива в начальном состоянии.
 *
 * Проверка сознательно грубая и оптимистичная: она отвечает на вопрос
 * «существует ли хотя бы один путь», а не «легко ли это сделать». Задача —
 * не выдать смену, где приказ невыполним физически: например, «сохранить
 * три портала», когда четыре из пяти схлопнутся раньше шестого цикла.
 */
export function directiveFeasible(
  directive: Directive,
  state: Pick<LabState, 'portals'>,
): boolean {
  const portals = state.portals.filter(isActive)
  if (portals.length === 0) return false

  switch (directive.id) {
    case 'NO_COLLAPSE':
      // Любой портал можно закрыть управляемо, а закрытие схлопыванием
      // не считается. Достаточно, чтобы порталы вообще были.
      return true

    case 'NO_LOSSES':
      // Существ теряет и закрытие, и схлопывание. Значит, каждый населённый
      // портал должен дожить до конца смены открытым.
      return portals
        .filter((portal) => portal.creaturesInside > 0)
        .every(survivesShift)

    case 'OBSERVERS':
      // Наблюдателя можно отправить только туда, где это разрешено сейчас,
      // и портал должен дожить хотя бы до его возвращения.
      return (
        portals.filter(
          (portal) =>
            checkAction(portal, 'SEND_OBSERVER').allowed &&
            portal.minutesToCollapse > drainOf(portal),
        ).length >= directive.target
      )

    case 'KEEP_OPEN':
      return portals.filter(survivesShift).length >= directive.target

    case 'NO_CRITICAL':
      // Критический портал всегда можно закрыть, а закрытый в активных
      // не учитывается.
      return true

    case 'STABILIZE_THREE':
      return (
        portals.filter(
          (portal) =>
            portal.stability < MAX_STABILITY &&
            portal.minutesToCollapse > drainOf(portal),
        ).length >= directive.target
      )
  }
}

/**
 * Выбор директивы по seed.
 *
 * Перебор идёт по перемешанному списку, а не по случайному индексу: если
 * первая директива в начальном состоянии невыполнима, берётся следующая
 * из того же перемешивания. Результат остаётся детерминированным, но смена
 * не отбраковывается целиком из-за неудачного приказа.
 */
export function pickDirective(
  random: Random,
  state: Pick<LabState, 'portals'>,
): Directive {
  const order = random.shuffle(DIRECTIVE_IDS)
  for (const id of order) {
    const directive = DIRECTIVES[id]
    if (directiveFeasible(directive, state)) return directive
  }
  return DIRECTIVES.NO_COLLAPSE
}

export interface DirectiveResult {
  directive: Directive
  met: boolean
  /** Достигнутое значение — то, что видно в итоге рядом с требуемым. */
  actual: number
  /** Одна фраза: что получилось и почему это засчитано или нет. */
  explanation: string
}

/** Текущее значение показателя, за которым следит директива. */
export function directiveProgress(directive: Directive, state: LabState): number {
  const portals = state.portals
  switch (directive.id) {
    case 'NO_COLLAPSE':
      return portals.filter((portal) => portal.status === 'COLLAPSED').length
    case 'NO_LOSSES':
      return portals.reduce((sum, portal) => sum + (portal.creaturesLost ?? 0), 0)
    case 'OBSERVERS':
      return state.observerReturns ?? 0
    case 'KEEP_OPEN':
      return portals.filter(isActive).length
    case 'NO_CRITICAL':
      return portals.filter(
        (portal) => isActive(portal) && computeRisk(portal).rank === 'S',
      ).length
    case 'STABILIZE_THREE':
      return portals.filter((portal) => portal.stabilizedEver).length
  }
}

/** Выполнена ли директива в данном состоянии. */
export function evaluateDirective(
  directive: Directive,
  state: LabState,
): DirectiveResult {
  const actual = directiveProgress(directive, state)
  // Директивы двух видов: «не больше нуля» и «не меньше N».
  const atMost = directive.target === 0
  const met = atMost ? actual === 0 : actual >= directive.target

  return {
    directive,
    met,
    actual,
    explanation: explain(directive, actual, met),
  }
}

function explain(directive: Directive, actual: number, met: boolean): string {
  switch (directive.id) {
    case 'NO_COLLAPSE':
      return met
        ? 'Ни один портал не схлопнулся.'
        : `Схлопнулось порталов: ${actual}. Директива не выполнена.`
    case 'NO_LOSSES':
      return met
        ? 'Существа не потеряны.'
        : `Потеряно существ: ${actual}. Директива не выполнена.`
    case 'OBSERVERS':
      return met
        ? `Наблюдателей вернулось: ${actual} при требуемых ${directive.target}.`
        : `Наблюдателей вернулось: ${actual} из ${directive.target}. Директива не выполнена.`
    case 'KEEP_OPEN':
      return met
        ? `Открытыми осталось порталов: ${actual} при требуемых ${directive.target}.`
        : `Открытыми осталось порталов: ${actual} из ${directive.target}. Директива не выполнена.`
    case 'NO_CRITICAL':
      return met
        ? 'Критических порталов ранга S к концу смены не осталось.'
        : `Критических порталов осталось: ${actual}. Директива не выполнена.`
    case 'STABILIZE_THREE':
      return met
        ? `Стабилизировано разных порталов: ${actual} при требуемых ${directive.target}.`
        : `Стабилизировано разных порталов: ${actual} из ${directive.target}. Директива не выполнена.`
  }
}
