/**
 * Состояние «Живой смены» — всё, что отличает её от демонстрационной.
 *
 * Хранится отдельным полем `LabState.live`, а не растворяется в общем
 * состоянии. Так три демонстрационных сценария остаются ровно теми же,
 * что в версии 1.0: у них это поле пустое, и ни одна проверка живого
 * режима до них не дотягивается.
 *
 * Здесь только типы: расписание событий строит `events.ts`, директиву —
 * `directives.ts`, разбор решений — `debrief.ts`.
 */

import type { PortalActionKind } from '../types'
import type { Directive } from './directives'
import type { ShiftEvent } from './events'
import type { ScienceEntry } from './score'

/** Одно принятое решение — строка будущего разбора смены. */
export interface DecisionRecord {
  /** Номер цикла, считая с 1, — как он показан человеку. */
  cycle: number
  atMinutes: number
  portalId: string
  portalName: string
  /** Что выбрал пользователь. */
  action: PortalActionKind
  /** Что предлагала система в этот момент. Подсказка, а не эталон. */
  recommended: PortalActionKind | null
  /** Объяснение рекомендации, каким оно было на момент решения. */
  recommendedText: string
  /** Короткий фактический результат: «риск 72 → 60». */
  outcome: string
}

/** Событие, которое уже случилось. Нужно журналу и разбору смены. */
export interface AppliedEvent {
  /** Номер перехода между циклами, считая с 1. */
  cycle: number
  event: ShiftEvent
  notes: string[]
}

export interface LiveShift {
  /** Код смены: `PL-7K42`. По нему смена воспроизводится целиком. */
  seed: string
  directive: Directive
  /**
   * По одному слоту на каждый переход между циклами; `null` — тихий переход.
   * Расписание задано при создании и не зависит от решений пользователя.
   */
  schedule: Array<ShiftEvent | null>
  applied: AppliedEvent[]
  timeline: DecisionRecord[]
  /**
   * Научные данные по фактам, а не одним числом: итоговый отчёт обязан
   * объяснить, из чего сложился блок «Научные данные», а не показать сумму.
   */
  science: ScienceEntry[]
}
