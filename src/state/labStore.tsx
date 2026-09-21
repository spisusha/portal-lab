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
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import { labReducer } from '../domain/reducer'
import { createInitialState } from '../domain/seed'
import {
  buildSummary,
  withRisk,
  type LabSummary,
  type PortalWithRisk,
} from '../domain/summary'
import { buildFocus, type FocusSituation } from '../domain/focus'
import { buildForecast, type CycleForecast } from '../domain/forecast'
import { diffStates, type PortalChange } from '../domain/diff'
import type { LabAction, LabState } from '../domain/types'

interface Tracked {
  state: LabState
  previous: LabState | null
  /** Номер шага: растёт на каждое действие, даже если состояние не изменилось. */
  step: number
  /** Действие, которое привело к текущему состоянию. */
  lastAction: LabAction['type'] | null
}

function trackingReducer(tracked: Tracked, action: LabAction): Tracked {
  const next = labReducer(tracked.state, action)
  return {
    state: next,
    previous: tracked.state,
    step: tracked.step + 1,
    lastAction: action.type,
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
}

const LabContext = createContext<LabContextValue | null>(null)

export function LabProvider({ children }: { children: ReactNode }) {
  const [tracked, dispatch] = useReducer(trackingReducer, undefined, () => ({
    state: createInitialState(),
    previous: null,
    step: 0,
    lastAction: null,
  }))

  const value = useMemo<LabContextValue>(() => {
    const { state, previous, step, lastAction } = tracked
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
