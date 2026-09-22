/**
 * Связка домена с React.
 *
 * Единственное место, где состояние лаборатории встречается с UI.
 * Вся логика остаётся в domain/: здесь только useReducer и контекст.
 *
 * Редьюсер домена обёрнут в `trackingReducer`. Обёртка ничего не решает —
 * она лишь запоминает предыдущее состояние и номер шага, чтобы интерфейс
 * мог показать «риск 72 → 60» сразу после нажатия. Сравнение считает
 * domain/diff, обёртка только хранит «до».
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import { labReducer } from '../domain/reducer'
import { createInitialState, createScenario } from '../domain/seed'
import {
  buildSummary,
  buildShiftSummary,
  type ShiftSummary,
  withRisk,
  type LabSummary,
  type PortalWithRisk,
} from '../domain/summary'
import { buildFocus, type FocusSituation } from '../domain/focus'
import { buildForecast, type CycleForecast } from '../domain/forecast'
import { diffStates, type PortalChange } from '../domain/diff'
import { computeLiveScore, type LiveScore } from '../domain/live/score'
import { buildDebrief, debriefHeadline, type DebriefRow } from '../domain/live/debrief'
import { evaluateDirective, type DirectiveResult } from '../domain/live/directives'
import type { LabAction, LabState } from '../domain/types'
import { readShiftLink, syncShiftUrl } from './liveSeed'

interface Tracked {
  state: LabState
  previous: LabState | null
  /** Номер шага: растёт на каждое действие, даже если состояние не изменилось. */
  step: number
  /** Действие, которое привело к текущему состоянию. */
  lastAction: LabAction['type'] | null
  /** Номер смены: растёт каждый раз, когда смена начинается заново. */
  shift: number
}

function trackingReducer(tracked: Tracked, action: LabAction): Tracked {
  const next = labReducer(tracked.state, action)
  // Смена действительно началась заново, только если сценарий загрузился,
  // а не упёрся в вопрос «сбросить прогресс?». Повтор той же живой смены
  // тоже считается новой сменой: seed прежний, а время и таймер — нет.
  const restarted =
    action.type === 'LOAD_SCENARIO' && next !== tracked.state && next.pendingConfirm === null
  return {
    state: next,
    // Перезапуск/смена сценария создаёт новую смену, а не превращает
    // терминальные порталы старой в открытые. Поэтому для него нет flash-diff.
    previous: action.type === 'LOAD_SCENARIO' ? null : tracked.state,
    step: tracked.step + 1,
    lastAction: action.type,
    shift: restarted ? tracked.shift + 1 : tracked.shift,
  }
}

export interface LabChange {
  /** Уникален для каждого шага — по нему интерфейс перезапускает показ. */
  step: number
  action: LabAction['type']
  portals: PortalChange[]
}

interface LabContextValue {
  state: LabState
  dispatch: Dispatch<LabAction>
  summary: LabSummary
  portals: PortalWithRisk[]
  /** Что требует решения прямо сейчас. null — активных порталов нет. */
  focus: FocusSituation | null
  /** Что случится через один цикл, если не вмешиваться. */
  forecast: CycleForecast
  /** Что изменилось последним действием. null — ещё ничего не нажимали. */
  change: LabChange | null
  shiftSummary: ShiftSummary
  lastAction: LabAction['type'] | null
  /** Итог живой смены: счёт, ранг и разбор по блокам. `null` — демо-режим. */
  liveScore: LiveScore | null
  /**
   * Номер начатой смены. Меняется только при загрузке сценария и служит
   * ключом для всего, что обязано начаться заново, — в первую очередь
   * для таймера живой смены.
   */
  shiftKey: number
  /** Директива смены и её текущее состояние. `null` — демо-режим. */
  directive: DirectiveResult | null
  /** Хроника принятых решений. Пуста вне живой смены. */
  debrief: DebriefRow[]
  debriefHeadline: string
}

const LabContext = createContext<LabContextValue | null>(null)

/**
 * Состояние на старте.
 *
 * Ссылка вида `?mode=live&seed=PL-7K42` обязана открыть ровно ту смену,
 * на которую ссылались: разбор адреса делается один раз здесь, а не в
 * эффекте после первого рендера, иначе человек увидел бы штатную смену
 * и только потом подмену.
 */
function openingState(): LabState {
  const link = readShiftLink()
  return link ? createScenario('live', link.seed) : createInitialState()
}

export function LabProvider({ children }: { children: ReactNode }) {
  const [tracked, dispatch] = useReducer(trackingReducer, undefined, () => ({
    state: openingState(),
    previous: null,
    step: 0,
    lastAction: null,
    shift: 0,
  }))

  const seedInUrl = tracked.state.scenario === 'live' ? tracked.state.live?.seed ?? null : null

  // Адресная строка всегда показывает текущую смену: из неё можно уйти в
  // закладки или переслать её, не нажимая «Поделиться».
  useEffect(() => {
    syncShiftUrl(seedInUrl)
  }, [seedInUrl])

  const value = useMemo<LabContextValue>(() => {
    const { state, previous, step, lastAction, shift } = tracked
    const rows = buildDebrief(state)
    return {
      state,
      dispatch,
      summary: buildSummary(state),
      portals: withRisk(state.portals),
      focus: buildFocus(state),
      forecast: buildForecast(state),
      change:
        previous && lastAction
          ? { step, action: lastAction, portals: diffStates(previous, state) }
          : null,
      shiftSummary: buildShiftSummary(state),
      lastAction,
      liveScore: computeLiveScore(state),
      shiftKey: shift,
      directive: state.live ? evaluateDirective(state.live.directive, state) : null,
      debrief: rows,
      debriefHeadline: debriefHeadline(rows),
    }
  }, [tracked])

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>
}

export function useLab(): LabContextValue {
  const value = useContext(LabContext)
  if (!value) {
    throw new Error('useLab вызван вне LabProvider')
  }
  return value
}
