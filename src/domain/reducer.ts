/**
 * Применение действий к состоянию лаборатории.
 *
 * Чистая функция: (состояние, действие) → новое состояние. Никакого React,
 * никаких побочных эффектов, ничего случайного — поэтому каждый сценарий
 * воспроизводим и покрывается тестом.
 *
 * Запреты редьюсер не дублирует: он спрашивает rules.checkAction. Если
 * действие запрещено, состояние не меняется, но в журнал попадает строка
 * с причиной — так видно, что защита сработала, даже если кнопку нажали
 * в обход интерфейса.
 */

import type {
  LabAction,
  LabState,
  LogEntry,
  LogKind,
  Portal,
  PortalActionKind,
} from './types'
import { ACTION_LABELS, CYCLE_MINUTES, isActive } from './types'
import { applyStabilize, checkAction } from './rules'
import { computeRisk } from './risk'
import { projectPortal } from './cycle'
import { createScenario } from './seed'

/**
 * Идентификатор записи журнала. Намеренно детерминированный, без Math.random:
 * одинаковая последовательность действий даёт одинаковый журнал, что
 * позволяет сравнивать его в тестах.
 */
function makeLogId(state: LabState, index: number): string {
  return `log-${state.clockMinutes}-${state.log.length + index}`
}

interface LogDraft {
  kind: LogKind
  text: string
  portal?: Portal | null
}

/** Добавляет записи в журнал. Свежие записи идут в начало списка. */
function withLog(state: LabState, drafts: LogDraft[]): LabState {
  if (drafts.length === 0) return state
  const entries: LogEntry[] = drafts.map((draft, index) => ({
    id: makeLogId(state, index),
    atMinutes: state.clockMinutes,
    portalId: draft.portal ? draft.portal.id : null,
    portalName: draft.portal ? draft.portal.name : null,
    kind: draft.kind,
    text: draft.text,
  }))
  return { ...state, log: [...entries.reverse(), ...state.log] }
}

/** Заменяет один портал новым значением. */
function replacePortal(state: LabState, next: Portal): LabState {
  return {
    ...state,
    portals: state.portals.map((p) => (p.id === next.id ? next : p)),
  }
}

function addHistory(portal: Portal, atMinutes: number, text: string): Portal {
  return { ...portal, history: [...portal.history, { atMinutes, text }] }
}

function findPortal(state: LabState, portalId: string): Portal | undefined {
  return state.portals.find((p) => p.id === portalId)
}

/**
 * Общая часть всех действий над порталом: найти портал, спросить правила,
 * при запрете записать причину в журнал.
 * Возвращает портал, если действие можно выполнять дальше.
 */
function guard(
  state: LabState,
  portalId: string,
  kind: PortalActionKind,
): { portal: Portal } | { blocked: LabState } {
  const portal = findPortal(state, portalId)
  if (!portal) {
    return {
      blocked: withLog(state, [
        { kind: 'blocked', text: `Портал ${portalId} не найден.` },
      ]),
    }
  }
  const check = checkAction(portal, kind)
  if (!check.allowed) {
    return {
      blocked: withLog(state, [
        {
          kind: 'blocked',
          portal,
          text: `Действие «${ACTION_LABELS[kind]}» отклонено: ${check.reason}`,
        },
      ]),
    }
  }
  return { portal }
}

export function labReducer(state: LabState, action: LabAction): LabState {
  switch (action.type) {
    case 'LOAD_SCENARIO': {
      const fresh = createScenario(action.scenario)
      return withLog(fresh, [
        {
          kind: 'system',
          text: `Загружен набор данных «${SCENARIO_TITLES[action.scenario]}». Смена начата заново.`,
        },
      ])
    }

    case 'CANCEL_CONFIRM': {
      return { ...state, pendingConfirm: null }
    }

    case 'STABILIZE': {
      const result = guard(state, action.portalId, 'STABILIZE')
      if ('blocked' in result) return result.blocked
      const portal = result.portal

      const riskBefore = computeRisk(portal).score
      let next: Portal = applyStabilize(portal)
      const riskAfter = computeRisk(next).score
      next = addHistory(
        next,
        state.clockMinutes,
        `Стабилизация: стабильность ${portal.stability} → ${next.stability}, энергия ${portal.energy} → ${next.energy}. Риск ${riskBefore} → ${riskAfter}.`,
      )

      return withLog(replacePortal(state, next), [
        {
          kind: 'action',
          portal: next,
          text: `Стабилизация выполнена. Риск снижен с ${riskBefore} до ${riskAfter}.`,
        },
      ])
    }

    case 'MARK_QUESTIONED': {
      const result = guard(state, action.portalId, 'MARK_QUESTIONED')
      if ('blocked' in result) return result.blocked

      const next = addHistory(
        { ...result.portal, status: 'QUESTIONED' },
        state.clockMinutes,
        'Портал помечен как «под вопросом»: требуется решение смотрителя.',
      )

      return withLog(replacePortal(state, next), [
        {
          kind: 'warning',
          portal: next,
          text: 'Портал помечен как «под вопросом».',
        },
      ])
    }

    case 'SEND_OBSERVER': {
      const result = guard(state, action.portalId, 'SEND_OBSERVER')
      if ('blocked' in result) return result.blocked

      const next = addHistory(
        { ...result.portal, observerInside: true },
        state.clockMinutes,
        'Наблюдатель направлен внутрь. Отчёт ожидается к следующему циклу.',
      )

      return withLog(replacePortal(state, next), [
        {
          kind: 'action',
          portal: next,
          text: 'Наблюдатель направлен внутрь портала.',
        },
      ])
    }

    case 'CLOSE': {
      const result = guard(state, action.portalId, 'CLOSE')
      if ('blocked' in result) return result.blocked
      const portal = result.portal

      const check = checkAction(portal, 'CLOSE')
      // Опасное закрытие требует второго шага: сначала вопрос, потом действие.
      if (check.requiresConfirm && !action.confirmed) {
        return {
          ...state,
          pendingConfirm: {
            portalId: portal.id,
            action: 'CLOSE',
            question: check.confirmQuestion ?? 'Подтвердить закрытие портала?',
          },
        }
      }

      const notes: string[] = []
      if (portal.creaturesInside > 0) {
        notes.push(`внутри осталось существ: ${portal.creaturesInside}`)
      }
      if (portal.observerInside) {
        notes.push('наблюдатель эвакуирован в аварийном режиме')
      }
      const suffix = notes.length > 0 ? ` (${notes.join('; ')})` : ''

      const next = addHistory(
        { ...portal, status: 'CLOSED', observerInside: false },
        state.clockMinutes,
        `Портал закрыт${suffix}.`,
      )

      return withLog({ ...replacePortal(state, next), pendingConfirm: null }, [
        {
          kind: notes.length > 0 ? 'warning' : 'action',
          portal: next,
          text: `Портал закрыт${suffix}.`,
        },
      ])
    }

    case 'NEXT_CYCLE': {
      return advanceCycle(state)
    }
  }
}

/**
 * Один цикл наблюдения — 15 минут.
 *
 * Сами показатели считает `projectPortal` из cycle.ts — та же функция,
 * по которой интерфейс строит прогноз «что будет через цикл». Здесь
 * остаётся то, чего у прогноза быть не должно: записи в историю портала
 * и в журнал смены.
 *
 * Никакой случайности: тот же ввод даёт тот же результат.
 */
function advanceCycle(state: LabState): LabState {
  const clockMinutes = state.clockMinutes + CYCLE_MINUTES
  const drafts: LogDraft[] = []

  const portals = state.portals.map((portal) => {
    if (!isActive(portal)) return portal

    const projected = projectPortal(portal)
    let next: Portal = { ...projected, history: portal.history }

    // Отчёт наблюдателя: сравниваем то, что показывали приборы, с тем,
    // что он увидел своими глазами.
    if (portal.observerInside) {
      const estimated = portal.creaturesInside
      const actual = portal.creaturesActual
      const delta =
        actual === estimated
          ? 'приборы не ошиблись'
          : actual > estimated
            ? `на ${actual - estimated} больше, чем показывали приборы`
            : `на ${estimated - actual} меньше, чем показывали приборы`
      next = addHistory(
        next,
        clockMinutes,
        `Отчёт наблюдателя: существ внутри ${actual} — ${delta}.`,
      )
      drafts.push({
        kind: 'action',
        portal: next,
        text: `Наблюдатель вернулся: подтверждено существ — ${actual} (${delta}).`,
      })
    }

    if (projected.status === 'COLLAPSED') {
      next = addHistory(next, clockMinutes, 'Время вышло: портал схлопнулся.')
      drafts.push({
        kind: 'critical',
        portal: next,
        text:
          next.creaturesInside > 0
            ? `Портал схлопнулся. Внутри оставалось существ: ${next.creaturesInside}.`
            : 'Портал схлопнулся.',
      })
    }

    return next
  })

  const advanced: LabState = { ...state, portals, clockMinutes }
  return withLog(advanced, [
    { kind: 'system', text: `Цикл наблюдения завершён (+${CYCLE_MINUTES} мин).` },
    ...drafts,
  ])
}

export const SCENARIO_TITLES: Record<LabState['scenario'], string> = {
  standard: 'Штатный режим',
  critical: 'Критическая ситуация',
  empty: 'Пустая лаборатория',
}
