/**
 * Связка домена с React.
 *
 * Единственное место, где состояние лаборатории встречается с UI.
 * Вся логика остаётся в domain/: здесь только useReducer и контекст.
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
import { buildSummary, withRisk, type LabSummary, type PortalWithRisk } from '../domain/summary'
import { buildFocus, type FocusSituation } from '../domain/focus'
import type { LabAction, LabState } from '../domain/types'

interface LabContextValue {
  state: LabState
  dispatch: Dispatch<LabAction>
  summary: LabSummary
  portals: PortalWithRisk[]
  /** Что требует решения прямо сейчас. null — активных порталов нет. */
  focus: FocusSituation | null
}

const LabContext = createContext<LabContextValue | null>(null)

export function LabProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(labReducer, undefined, createInitialState)

  const value = useMemo<LabContextValue>(
    () => ({
      state,
      dispatch,
      summary: buildSummary(state),
      portals: withRisk(state.portals),
      focus: buildFocus(state),
    }),
    [state],
  )

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>
}

export function useLab(): LabContextValue {
  const value = useContext(LabContext)
  if (!value) {
    throw new Error('useLab вызван вне LabProvider')
  }
  return value
}
