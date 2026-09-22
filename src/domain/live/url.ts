/**
 * Ссылка на смену: `?mode=live&seed=PL-7K42`.
 *
 * Модуль чистый: он работает со строкой запроса, а не с `window.location`.
 * Благодаря этому разбор и сборка ссылки проверяются обычным тестом без
 * браузера, а адаптер в `state/` остаётся тонким.
 *
 * Про base path. Сайт живёт не в корне домена, а по пути `/portal-lab/`.
 * Строка запроса от пути не зависит, поэтому здесь про base знать нечего —
 * важно другое: собирая ссылку, нельзя подставлять корень, иначе на GitHub
 * Pages получится ссылка на несуществующую страницу. Поэтому `buildShiftUrl`
 * требует origin и path снаружи и ничего не додумывает сам.
 *
 * В URL кодируется только сам seed. Всю последовательность решений сюда
 * не кладут: это была бы не ссылка на смену, а сохранённое прохождение,
 * выданное за результат.
 */

import { normalizeSeed } from './seedCode'

export const MODE_PARAM = 'mode'
export const SEED_PARAM = 'seed'
export const LIVE_MODE = 'live'

export interface ShiftLink {
  /** Код смены, уже приведённый к каноническому виду. */
  seed: string
}

/**
 * Разбор строки запроса.
 *
 * `null` означает «обычный запуск»: живой режим включается только явной
 * парой `mode=live` и непустым `seed`. Ссылка без seed не должна молча
 * открывать случайную смену — это сломало бы обещание воспроизводимости.
 */
export function parseShiftLink(search: string): ShiftLink | null {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  )
  if (params.get(MODE_PARAM) !== LIVE_MODE) return null
  const raw = params.get(SEED_PARAM)
  if (!raw || raw.trim().length === 0) return null
  return { seed: normalizeSeed(raw) }
}

/** Строка запроса для текущей смены — то, что встаёт в адресную строку. */
export function buildShiftSearch(seed: string): string {
  const params = new URLSearchParams()
  params.set(MODE_PARAM, LIVE_MODE)
  params.set(SEED_PARAM, normalizeSeed(seed))
  return `?${params.toString()}`
}

/**
 * Полная ссылка для кнопки «Поделиться сменой».
 *
 * origin и path передаются снаружи, потому что на GitHub Pages путь —
 * `/portal-lab/`, а в локальной разработке он тот же, но origin другой.
 * Домен не имеет права угадывать ни то, ни другое.
 */
export function buildShiftUrl(
  origin: string,
  path: string,
  seed: string,
): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${origin.replace(/\/$/, '')}${cleanPath}${buildShiftSearch(seed)}`
}
