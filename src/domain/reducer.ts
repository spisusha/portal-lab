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
import {
  ACTION_LABELS,
  CYCLE_MINUTES,
  MAX_CYCLES,
  currentCycle,
  formatClock,
  isActive,
} from './types'
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
  if (state.shiftStatus === 'COMPLETE') {
    return {
      blocked: withLog(state, [
        { kind: 'blocked', text: 'Смена завершена. Действия больше недоступны.' },
      ]),
    }
  }
  const portal = findPortal(state, portalId)
  if (!portal) {
    return {
      blocked: withLog(state, [
        { kind: 'blocked', text: `Портал ${portalId} не найден.` },
      ]),
    }
  }
  const check = checkAction(portal, kind, currentCycle(state))
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
      if (
        !action.confirmed &&
        (state.decisionCount ?? 0) > 0
      ) {
        return {
          ...state,
          pendingScenario: action.scenario,
          pendingConfirm: {
            action: 'LOAD_SCENARIO',
            scenario: action.scenario,
            question: 'Прогресс текущей смены будет сброшен. Загрузить другой демо-сценарий?',
          },
        }
      }
      const fresh = createScenario(action.scenario)
      const loaded = withLog(fresh, [
        {
          kind: 'system',
          text: `Загружен набор данных «${SCENARIO_TITLES[action.scenario]}». Смена начата заново.`,
        },
      ])
      return action.scenario === 'empty' ? completeShift(loaded, 'empty') : loaded
    }

    case 'CANCEL_CONFIRM': {
      return {
        ...state,
        pendingConfirm: null,
        pendingScenario: null,
        pendingCycleConfirm: null,
      }
    }

    case 'CANCEL_NEXT_CYCLE': {
      return { ...state, pendingCycleConfirm: null, pendingConfirm: null }
    }

    case 'CANCEL_SCENARIO': {
      return { ...state, pendingScenario: null, pendingConfirm: null }
    }

    case 'STABILIZE': {
      const result = guard(state, action.portalId, 'STABILIZE')
      if ('blocked' in result) return result.blocked
      const portal = result.portal

      const riskBefore = computeRisk(portal).score
      let next: Portal = applyStabilize(portal)
      const riskAfter = computeRisk(next).score
      next = acceptDecision(next, state, 'STABILIZE', true)
      next = addHistory(
        next,
        state.clockMinutes,
        `Решение принято · ${formatClock(state.clockMinutes)}. Стабилизация: стабильность ${portal.stability} → ${next.stability}, энергия ${portal.energy} → ${next.energy}. Риск ${riskBefore} → ${riskAfter}.`,
      )

      return withLog({ ...replacePortal(state, next), decisionCount: (state.decisionCount ?? 0) + 1 }, [
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
        acceptDecision({ ...result.portal, status: 'QUESTIONED' }, state, 'MARK_QUESTIONED'),
        state.clockMinutes,
        `Решение принято · ${formatClock(state.clockMinutes)}. Портал помечен как «под вопросом»: требуется решение смотрителя.`,
      )

      return withLog({ ...replacePortal(state, next), decisionCount: (state.decisionCount ?? 0) + 1 }, [
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
        acceptDecision({ ...result.portal, observerInside: true }, state, 'SEND_OBSERVER'),
        state.clockMinutes,
        `Решение принято · ${formatClock(state.clockMinutes)}. Наблюдатель направлен внутрь. Отчёт ожидается к следующему циклу.`,
      )

      return withLog({ ...replacePortal(state, next), decisionCount: (state.decisionCount ?? 0) + 1 }, [
        {
          kind: 'action',
          portal: next,
          text: 'Наблюдатель направлен внутрь портала.',
        },
      ])
    }

    case 'CLOSE': {
      const validConfirmation =
        action.confirmed &&
        state.pendingConfirm?.action === 'CLOSE' &&
        state.pendingConfirm.portalId === action.portalId
      const result = validConfirmation
        ? (() => {
            const portal = findPortal(state, action.portalId)
            if (!portal) return guard(state, action.portalId, 'CLOSE')
            // A confirmation belongs to the close request that was already
            // shown. Do not re-run the one-decision guard for that second
            // step, otherwise confirming a close would be mistaken for a
            // duplicate decision.
            const check = checkAction(portal, 'CLOSE')
            return check.allowed ? { portal } : guard(state, action.portalId, 'CLOSE')
          })()
        : guard(state, action.portalId, 'CLOSE')
      if ('blocked' in result) return result.blocked
      const portal = result.portal

      const check = checkAction(portal, 'CLOSE', currentCycle(state))
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
        acceptDecision(
          {
            ...portal,
            status: 'CLOSED',
            observerInside: false,
            creaturesLost: portal.creaturesInside,
          },
          state,
          'CLOSE',
        ),
        state.clockMinutes,
        `Решение принято · ${formatClock(state.clockMinutes)}. Портал закрыт${suffix}.`,
      )

      const closed = withLog({ ...replacePortal(state, next), pendingConfirm: null, decisionCount: (state.decisionCount ?? 0) + 1 }, [
        {
          kind: notes.length > 0 ? 'warning' : 'action',
          portal: next,
          text: `Портал закрыт${suffix}.`,
        },
      ])
      return finalizeIfNeeded(closed, 'empty')
    }

    case 'NEXT_CYCLE': {
      if (state.shiftStatus === 'COMPLETE') return state
      const pending = state.portals.filter(
        (portal) => isActive(portal) && portal.decisionCycle !== currentCycle(state),
      ).length
      if (pending > 0 && !action.confirmed) {
        return {
          ...state,
          pendingConfirm: {
            action: 'NEXT_CYCLE',
            question: `Для ${pending} ${pending === 1 ? 'портала' : 'порталов'} решение не принято. Всё равно перейти к следующему циклу?`,
          },
          pendingCycleConfirm: pending,
        }
      }
      return advanceCycle({ ...state, pendingConfirm: null, pendingCycleConfirm: null })
    }
  }
}

function acceptDecision(
  portal: Portal,
  state: LabState,
  _kind: PortalActionKind,
  stabilized = false,
): Portal {
  return {
    ...portal,
    decisionCycle: currentCycle(state),
    decisionAtMinutes: state.clockMinutes,
    stabilizedEver: portal.stabilizedEver === true || stabilized,
  }
}

function completeShift(
  state: LabState,
  reason: 'cycles' | 'empty',
  unresolvedAtEnd?: number,
): LabState {
  if (state.shiftStatus === 'COMPLETE') return state
  const finished = {
    ...state,
    shiftStatus: 'COMPLETE' as const,
    finishedAtMinutes: state.clockMinutes,
    pendingConfirm: null,
    pendingCycleConfirm: null,
    unresolvedAtEnd:
      unresolvedAtEnd ??
      state.portals.filter(
        (portal) => isActive(portal) && portal.decisionCycle !== currentCycle(state),
      ).length,
  }
  return withLog(finished, [
    {
      kind: reason === 'cycles' ? 'system' : 'warning',
      text:
        reason === 'cycles'
          ? `Демо-смена завершена после ${MAX_CYCLES} циклов.`
          : 'Демо-смена завершена досрочно: открытых порталов не осталось.',
    },
  ])
}

function finalizeIfNeeded(state: LabState, reason: 'empty'): LabState {
  return state.portals.some(isActive) ? state : completeShift(state, reason)
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
    let next: Portal = {
      ...projected,
      history: portal.history,
      decisionCycle: null,
      decisionAtMinutes: null,
    }

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
      next = { ...next, creaturesLost: next.creaturesInside }
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

  const advanced: LabState = {
    ...state,
    portals,
    clockMinutes,
    pendingConfirm: null,
    pendingCycleConfirm: null,
    decisionCount: state.decisionCount ?? 0,
    observerReturns: (state.observerReturns ?? 0) + state.portals.filter((portal) => portal.observerInside).length,
  }
  const withCycleLog = withLog(advanced, [
    { kind: 'system', text: `Цикл наблюдения завершён (+${CYCLE_MINUTES} мин).` },
    ...drafts,
  ])
  if (clockMinutes >= MAX_CYCLES * CYCLE_MINUTES) {
    const unresolvedAtEnd = portals.reduce(
      (count, portal, index) =>
        isActive(portal) &&
        state.portals[index].decisionCycle !== currentCycle(state)
          ? count + 1
          : count,
      0,
    )
    return completeShift(withCycleLog, 'cycles', unresolvedAtEnd)
  }
  return finalizeIfNeeded(withCycleLog, 'empty')
}

export const SCENARIO_TITLES: Record<LabState['scenario'], string> = {
  standard: 'Штатный режим',
  critical: 'Критическая ситуация',
  empty: 'Пустая лаборатория',
}
