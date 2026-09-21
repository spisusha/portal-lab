/**
 * Типы предметной области.
 *
 * Этот файл — и весь каталог domain/ — не знает про React.
 * Здесь только данные и правила, чтобы логику можно было тестировать отдельно
 * от интерфейса.
 */

/** Статус портала. CLOSED и COLLAPSED — терминальные: из них нет выхода. */
export type PortalStatus = 'OPEN' | 'QUESTIONED' | 'CLOSED' | 'COLLAPSED'

/** Ранг опасности в терминологии лаборатории: от E (безобидный) до S (критический). */
export type RiskRank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S'

/** Действия смотрителя над конкретным порталом. */
export type PortalActionKind =
  | 'STABILIZE'
  | 'SEND_OBSERVER'
  | 'CLOSE'
  | 'MARK_QUESTIONED'

export interface Portal {
  id: string
  /** Название портала, например «Врата №7 — Синий разлом». */
  name: string
  /** Мир назначения. */
  world: string
  /** Уровень энергии, 0–100. Чем выше, тем опаснее. */
  energy: number
  /** Стабильность, 0–100. Чем ниже, тем опаснее. */
  stability: number
  /** Минут до схлопывания. 0 — портал схлопывается. */
  minutesToCollapse: number
  /**
   * Существ внутри по данным приборов. До отправки наблюдателя это оценка,
   * после — подтверждённое число.
   */
  creaturesInside: number
  /**
   * Реальное число существ. Используется только наблюдателем и никогда
   * не показывается пользователю напрямую — иначе разведка теряет смысл.
   */
  creaturesActual: number
  /** Подтверждено ли число существ наблюдателем. */
  creaturesConfirmed: boolean
  status: PortalStatus
  /** Находится ли наблюдатель внутри портала прямо сейчас. */
  observerInside: boolean
  /** История изменений самого портала (показывается в карточке). */
  history: HistoryEntry[]
}

export interface HistoryEntry {
  /** Время внутри смены в минутах от её начала. */
  atMinutes: number
  text: string
}

/**
 * Результат проверки действия.
 *
 * reason заполняется только когда allowed === false: это текст, который
 * пользователь видит рядом с неактивной кнопкой, ещё до нажатия.
 * requiresConfirm означает, что действие разрешено, но требует второго шага.
 */
export interface ActionCheck {
  allowed: boolean
  reason?: string
  requiresConfirm?: boolean
  confirmQuestion?: string
}

/** Тип записи в журнале событий — определяет цвет строки в интерфейсе. */
export type LogKind = 'action' | 'blocked' | 'warning' | 'critical' | 'system'

export interface LogEntry {
  id: string
  atMinutes: number
  portalId: string | null
  portalName: string | null
  kind: LogKind
  text: string
}

export type ScenarioId = 'standard' | 'critical' | 'empty'

/**
 * Запрос на подтверждение опасного действия.
 * Сейчас это только закрытие портала с существами внутри.
 */
export interface PendingConfirm {
  portalId: string
  action: 'CLOSE'
  question: string
}

export interface LabState {
  portals: Portal[]
  log: LogEntry[]
  /** Минут от начала смены. Смена начинается в 08:00. */
  clockMinutes: number
  scenario: ScenarioId
  pendingConfirm: PendingConfirm | null
}

export type LabAction =
  | { type: 'STABILIZE'; portalId: string }
  | { type: 'SEND_OBSERVER'; portalId: string }
  | { type: 'MARK_QUESTIONED'; portalId: string }
  | { type: 'CLOSE'; portalId: string; confirmed?: boolean }
  | { type: 'CANCEL_CONFIRM' }
  | { type: 'NEXT_CYCLE' }
  | { type: 'LOAD_SCENARIO'; scenario: ScenarioId }

/** Минут в одном цикле наблюдения. */
export const CYCLE_MINUTES = 15

/** Смена смотрителя начинается в 08:00. */
export const SHIFT_START_MINUTES = 8 * 60

/** Портал считается активным, пока он не закрыт и не схлопнулся. */
export function isActive(portal: Portal): boolean {
  return portal.status === 'OPEN' || portal.status === 'QUESTIONED'
}

/** Переводит внутреннее время смены в часы:минуты. */
export function formatClock(atMinutes: number): string {
  const total = SHIFT_START_MINUTES + atMinutes
  const hours = Math.floor(total / 60) % 24
  const minutes = total % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** Человекочитаемое время до схлопывания: «2 ч 15 мин». */
export function formatCountdown(minutes: number): string {
  if (minutes <= 0) return 'схлопнулся'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} мин`
  if (rest === 0) return `${hours} ч`
  return `${hours} ч ${rest} мин`
}

export const STATUS_LABELS: Record<PortalStatus, string> = {
  OPEN: 'Открыт',
  QUESTIONED: 'Под вопросом',
  CLOSED: 'Закрыт',
  COLLAPSED: 'Схлопнулся',
}

export const ACTION_LABELS: Record<PortalActionKind, string> = {
  STABILIZE: 'Стабилизировать',
  SEND_OBSERVER: 'Отправить наблюдателя',
  CLOSE: 'Закрыть портал',
  MARK_QUESTIONED: 'Пометить «под вопросом»',
}
