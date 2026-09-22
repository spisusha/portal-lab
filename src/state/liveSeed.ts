/**
 * Адаптер между браузером и чистым доменом живой смены.
 *
 * Здесь — и только здесь — живёт настоящая случайность и обращение к
 * адресной строке. Домен получает готовую строку seed и дальше полностью
 * детерминирован; если бы `crypto.getRandomValues` вызывался внутри
 * генератора, ни один доменный тест нельзя было бы написать без моков,
 * а смена перестала бы воспроизводиться по ссылке.
 *
 * Модуль тонкий намеренно: разбор и сборка ссылки лежат в `domain/live/url.ts`
 * и проверяются без браузера, здесь остаётся только доступ к `window`.
 */

import {
  SEED_ALPHABET,
  SEED_BODY_LENGTH,
  formatSeed,
} from '../domain/live/seedCode'
import {
  buildShiftSearch,
  buildShiftUrl,
  parseShiftLink,
  type ShiftLink,
} from '../domain/live/url'

/**
 * Новый код смены.
 *
 * Отбраковка нужна из-за смещения: 256 не делится на 28, и без неё первые
 * четыре буквы алфавита выпадали бы чаще остальных. На глаз это незаметно,
 * но код смены — то, чем обмениваются, и перекос в нём выглядел бы
 * небрежностью.
 */
export function createSeedCode(): string {
  const limit = Math.floor(256 / SEED_ALPHABET.length) * SEED_ALPHABET.length
  const body: string[] = []

  while (body.length < SEED_BODY_LENGTH) {
    for (const byte of randomBytes(SEED_BODY_LENGTH)) {
      if (byte >= limit) continue
      body.push(SEED_ALPHABET[byte % SEED_ALPHABET.length])
      if (body.length === SEED_BODY_LENGTH) break
    }
  }

  return formatSeed(body.join(''))
}

function randomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count)
  const source = globalThis.crypto
  if (source && typeof source.getRandomValues === 'function') {
    source.getRandomValues(bytes)
    return bytes
  }
  // Запасной путь для сред без Web Crypto. В домене такое было бы
  // нарушением правила, здесь — единственный способ не уронить приложение.
  for (let i = 0; i < count; i++) bytes[i] = Math.floor(Math.random() * 256)
  return bytes
}

/** Живая смена, запрошенная ссылкой. `null` — обычный запуск. */
export function readShiftLink(): ShiftLink | null {
  if (typeof window === 'undefined') return null
  return parseShiftLink(window.location.search)
}

/**
 * Держит адресную строку в согласии с тем, что на экране.
 *
 * `replaceState`, а не `pushState`: смена режима — не переход по истории,
 * и кнопка «назад» не должна возвращать в середину чужой смены. Путь берётся
 * из самой страницы, поэтому base path `/portal-lab/` сохраняется сам собой.
 */
export function syncShiftUrl(seed: string | null): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return
  const { pathname, search, hash } = window.location
  const next = seed ? buildShiftSearch(seed) : ''
  if (search === next) return
  window.history.replaceState(null, '', `${pathname}${next}${hash}`)
}

/** Полная ссылка на текущую смену — то, что уходит в буфер обмена. */
export function shiftUrlFor(seed: string): string {
  if (typeof window === 'undefined') return buildShiftSearch(seed)
  return buildShiftUrl(window.location.origin, window.location.pathname, seed)
}

/**
 * Копирование ссылки.
 *
 * Современный API доступен не везде: в небезопасном контексте
 * `navigator.clipboard` отсутствует. Запасной путь через скрытое поле нужен,
 * чтобы кнопка не оказалась мёртвой — а её результат в любом случае
 * подтверждается текстом на экране, а не только сменой иконки.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Падаем на запасной путь ниже.
  }

  try {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(field)
    return copied
  } catch {
    return false
  }
}
