/**
 * Один переход между циклами, посчитанный целиком.
 *
 * В версии 1.0 общей точкой редьюсера и прогноза была `projectPortal`:
 * один портал, одна функция, разойтись нечем. С появлением событий этого
 * стало мало — «Спокойное окно» меняет сам расчёт цикла, а миграция
 * действует сразу на два портала. Поэтому общей точкой становится весь
 * переход: и редьюсер, и блок «Через цикл» зовут `simulateCycle`.
 *
 * Отсюда прямо следует требование ТЗ «прогноз события совпадает с фактическим
 * результатом»: это не две согласованные реализации, а один вызов.
 *
 * Функция ничего не записывает: ни истории портала, ни журнала. Прогноз не
 * имеет права оставлять следы, а редьюсер добавляет записи сам.
 */

import type { LabState, Portal } from './types'
import { currentCycle } from './types'
import { projectPortal } from './cycle'
import { applyEvent, calmsDecay, describeEvent, type ShiftEvent } from './live/events'

export interface CycleSimulation {
  /** Порталы после цикла и после события — в исходном порядке. */
  portals: Portal[]
  /** Событие этого перехода. `null` — тихий переход или демо-сценарий. */
  event: ShiftEvent | null
  /** Что событие сделало, с числами. Строки идут в журнал смены. */
  notes: string[]
  /** Обещание, которое показывается ДО нажатия кнопки. */
  announcement: string | null
}

/** Событие, назначенное на ближайший переход. Для демо-сценариев — `null`. */
export function upcomingEvent(state: LabState): ShiftEvent | null {
  const live = state.live
  if (!live) return null
  return live.schedule[currentCycle(state)] ?? null
}

export function simulateCycle(state: LabState): CycleSimulation {
  const event = upcomingEvent(state)
  const calm = calmsDecay(event)

  // Демо-сценарий: событий нет, `calm` всегда false — расчёт побайтово
  // тот же, что и в версии 1.0.
  const projected = state.portals.map((portal) => projectPortal(portal, { calm }))
  const outcome = applyEvent(event, projected)

  return {
    portals: outcome.portals,
    event,
    notes: outcome.notes,
    announcement: describeEvent(event, state.portals),
  }
}
