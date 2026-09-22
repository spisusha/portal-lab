/**
 * Настоящее время живой смены.
 *
 * Единственное место во всём проекте, где есть `Date.now`, `setInterval` и
 * понятие «реальная секунда». Домен об этом не знает и знать не должен:
 * он по-прежнему получает одну явную команду `NEXT_CYCLE` и считает переход
 * той же функцией, что и раньше. Уберите этот файл — приложение останется
 * рабочим, просто время придётся двигать рукой.
 *
 * Масштаб выбран так, чтобы смену можно было пройти за один присест:
 * лабораторный цикл в 15 минут проходит за 60 реальных секунд, то есть
 * одна игровая минута — четыре реальные. Шесть циклов укладываются в шесть
 * минут, а не в полтора часа.
 *
 * Часы в шапке идут поминутно, но `clockMinutes` в состоянии между
 * переходами не меняется: минуты внутри цикла — это `elapsedMinutes`,
 * смещение только для показа. Иначе `currentCycle` съезжал бы посреди цикла
 * и правило «одно решение за цикл» ломалось бы само по себе.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLab } from './labStore'
import { CYCLE_MINUTES } from '../domain/types'

/** Сколько реального времени занимает один лабораторный цикл. */
export const CYCLE_REAL_MS = 60_000

/** Одна лабораторная минута в реальном времени. */
export const MINUTE_REAL_MS = CYCLE_REAL_MS / CYCLE_MINUTES

/**
 * Шаг опроса. Достаточно мелкий, чтобы секунды на экране не перескакивали
 * через одну, и достаточно крупный, чтобы не будить React 60 раз в секунду.
 */
const TICK_MS = 250

/**
 * Причина остановки.
 *
 * `auto` — таймер продолжится сам, как только причина исчезнет: человек
 * закрыл инструкцию или подтверждение и остался на том же экране.
 * `manual` — после исчезновения причины нужно нажать «Продолжить»: время,
 * сдвинувшееся само, пока человек был в другой вкладке, стало бы
 * неприятным сюрпризом.
 */
type BlockKind = 'auto' | 'manual'

interface Block {
  reason: string
  kind: BlockKind
}

/** Чем позже в списке, тем важнее причина: её и показываем. */
const BLOCK_ORDER = ['worklog', 'intro', 'confirm', 'hidden'] as const

export interface LiveClockValue {
  /** Таймеру есть чем управлять: идёт живая смена и она не завершена. */
  available: boolean
  /** Смену уже запускали кнопкой «Начать живую смену». */
  started: boolean
  /** Отсчёт идёт прямо сейчас. */
  running: boolean
  /** Смена запущена, но время стоит. */
  paused: boolean
  /**
   * Время стоит по причине, которая исчезнет сама: открыта инструкция,
   * подтверждение или вкладка отчёта. Нажимать «Продолжить» не нужно, и
   * кнопки в этом состоянии нет — иначе она предлагала бы бездействие.
   */
  autoPaused: boolean
  /** Почему время стоит. `null` — не стоит. */
  pauseReason: string | null
  /** Осталось реального времени до автоматического перехода, мс. */
  remainingMs: number
  /** `01:00` … `00:00` — то, что видно на экране. */
  countdown: string
  /**
   * Лабораторных минут прошло внутри текущего цикла, 0…14.
   * Шапка прибавляет их к `clockMinutes` — и только для показа.
   */
  elapsedMinutes: number
  start: () => void
  pause: () => void
  resume: () => void
  /** Перейти к следующему циклу немедленно, не дожидаясь отсчёта. */
  finishNow: () => void
  /** Зарегистрировать или снять причину остановки. */
  setBlock: (key: string, block: Block | null) => void
}

const LiveClockContext = createContext<LiveClockValue | null>(null)

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function LiveClockProvider({ children }: { children: ReactNode }) {
  const { state, dispatch, shiftKey } = useLab()

  const [started, setStarted] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [remaining, setRemaining] = useState(CYCLE_REAL_MS)
  const [blocks, setBlocks] = useState<Record<string, Block>>({})
  /**
   * Причина последней остановки, которая пережила саму причину: вкладку
   * уже вернули, а «Продолжить» ещё не нажали — человеку нужно понимать,
   * почему время стоит.
   */
  const [heldReason, setHeldReason] = useState<string | null>(null)

  const remainingRef = useRef(CYCLE_REAL_MS)
  const advancingRef = useRef(false)

  const available = state.scenario === 'live' && state.shiftStatus !== 'COMPLETE'

  const setBlock = useCallback((key: string, block: Block | null) => {
    setBlocks((current) => {
      const existing = current[key] ?? null
      if (existing === null && block === null) return current
      if (
        existing &&
        block &&
        existing.reason === block.reason &&
        existing.kind === block.kind
      ) {
        return current
      }
      const next = { ...current }
      if (block) next[key] = block
      else delete next[key]
      return next
    })
  }, [])

  // Скрытая вкладка — причина остановки, и снимать её автоматически нельзя.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const sync = () => {
      setBlock(
        'hidden',
        document.visibilityState === 'hidden'
          ? { reason: 'Таймер приостановлен: вкладка неактивна.', kind: 'manual' }
          : null,
      )
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [setBlock])

  // Любое модальное окно домена останавливает время: решение о закрытии
  // портала нельзя принимать под тикающий отсчёт.
  useEffect(() => {
    setBlock(
      'confirm',
      state.pendingConfirm
        ? { reason: 'Таймер приостановлен, пока открыто подтверждение.', kind: 'auto' }
        : null,
    )
  }, [state.pendingConfirm, setBlock])

  // Новая смена — новый таймер. Повтор той же смены тоже считается новой:
  // поэтому ключ приходит из хранилища, а не собирается из seed.
  useEffect(() => {
    setStarted(false)
    setStopped(false)
    setHeldReason(null)
    remainingRef.current = CYCLE_REAL_MS
    setRemaining(CYCLE_REAL_MS)
    advancingRef.current = false
  }, [shiftKey])

  const active = BLOCK_ORDER.map((key) => blocks[key]).filter(Boolean) as Block[]
  const block = active.at(-1) ?? null
  const manualReason = active.find((item) => item.kind === 'manual')?.reason ?? null

  // Причина типа `manual` не просто придерживает время — она его
  // останавливает: после неё нужно осознанное «Продолжить».
  useEffect(() => {
    if (!manualReason) return
    setStopped(true)
    setHeldReason(manualReason)
  }, [manualReason])

  const running = available && started && !stopped && block === null

  const advance = useCallback(() => {
    if (advancingRef.current) return
    advancingRef.current = true
    // Сброс до отправки действия: если отсчёт закончится в тот же момент,
    // когда нажали «Завершить цикл сейчас», второй вызов увидит полный
    // остаток и перехода не сделает.
    remainingRef.current = CYCLE_REAL_MS
    setRemaining(CYCLE_REAL_MS)
    dispatch({ type: 'NEXT_CYCLE', confirmed: true })
    advancingRef.current = false
  }, [dispatch])

  // Один интервал на всё приложение. Пока `running` ложно — интервала нет
  // вовсе, поэтому ни смена режима, ни конец смены, ни размонтирование
  // не оставляют висящий таймер.
  useEffect(() => {
    if (!running) return
    let last = Date.now()
    const id = window.setInterval(() => {
      const now = Date.now()
      const delta = now - last
      last = now
      if (delta <= 0) return
      const left = remainingRef.current - delta
      if (left <= 0) {
        advance()
        return
      }
      remainingRef.current = left
      setRemaining(left)
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [running, advance])

  const start = useCallback(() => {
    remainingRef.current = CYCLE_REAL_MS
    setRemaining(CYCLE_REAL_MS)
    setHeldReason(null)
    setStopped(false)
    setStarted(true)
  }, [])

  const pause = useCallback(() => {
    setStopped(true)
    setHeldReason('Таймер остановлен вручную.')
  }, [])

  const resume = useCallback(() => {
    setHeldReason(null)
    setStopped(false)
    setStarted(true)
  }, [])

  const finishNow = useCallback(() => {
    if (!available) return
    advance()
  }, [available, advance])

  const value = useMemo<LiveClockValue>(() => {
    const paused = available && started && !running
    return {
      available,
      started: available && started,
      running,
      paused,
      autoPaused: paused && !stopped && block !== null,
      pauseReason: paused ? (block?.reason ?? heldReason) : null,
      remainingMs: remaining,
      countdown: formatCountdown(remaining),
      elapsedMinutes:
        available && started
          ? Math.min(
              CYCLE_MINUTES - 1,
              Math.floor((CYCLE_REAL_MS - remaining) / MINUTE_REAL_MS),
            )
          : 0,
      start,
      pause,
      resume,
      finishNow,
      setBlock,
    }
  }, [
    available,
    started,
    running,
    stopped,
    block,
    heldReason,
    remaining,
    start,
    pause,
    resume,
    finishNow,
    setBlock,
  ])

  return <LiveClockContext.Provider value={value}>{children}</LiveClockContext.Provider>
}

export function useLiveClock(): LiveClockValue {
  const value = useContext(LiveClockContext)
  if (!value) {
    throw new Error('useLiveClock вызван вне LiveClockProvider')
  }
  return value
}

/**
 * Объявить причину остановки из интерфейса.
 *
 * Компонент не управляет таймером напрямую — он лишь сообщает, что сейчас
 * открыто. Решение, останавливаться ли и требовать ли потом «Продолжить»,
 * принимает провайдер.
 */
export function useClockBlock(
  key: string,
  reason: string | null,
  kind: BlockKind = 'auto',
): void {
  const { setBlock } = useLiveClock()
  useEffect(() => {
    setBlock(key, reason ? { reason, kind } : null)
    return () => setBlock(key, null)
  }, [key, reason, kind, setBlock])
}
