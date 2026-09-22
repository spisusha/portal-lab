/**
 * Код смены: короткая строка вида `PL-7K42`.
 *
 * Seed показывается человеку и передаётся ссылкой, поэтому он обязан
 * читаться вслух и переписываться с экрана без ошибок. Из алфавита убраны
 * пары, которые путают: 0 и O, 1 и I, 5 и S, 8 и B.
 *
 * Сам домен ничего не генерирует: он принимает готовую строку. Создание
 * нового кода — дело адаптера (`state/liveSeed.ts`), у которого есть
 * `crypto.getRandomValues`. Здесь только формат, проверка и приведение
 * к каноническому виду.
 */

/** Алфавит кода: без пар, которые путаются при чтении с экрана. */
export const SEED_ALPHABET = '234679ACDEFGHJKLMNPQRTUVWXYZ'

export const SEED_PREFIX = 'PL-'

/** Длина значащей части кода. 28^4 ≈ 614 тысяч вариантов — достаточно. */
export const SEED_BODY_LENGTH = 4

const BODY_PATTERN = new RegExp(`^[${SEED_ALPHABET}]{${SEED_BODY_LENGTH}}$`)

/** Собирает канонический код из значащей части: `7K42` → `PL-7K42`. */
export function formatSeed(body: string): string {
  return `${SEED_PREFIX}${body.toUpperCase()}`
}

/** Код правильного формата — тот, который приложение выдало само. */
export function isCanonicalSeed(seed: string): boolean {
  const upper = seed.trim().toUpperCase()
  return (
    upper.startsWith(SEED_PREFIX) &&
    BODY_PATTERN.test(upper.slice(SEED_PREFIX.length))
  )
}

/**
 * Приводит к рабочему виду всё, что пришло извне.
 *
 * Чужую строку из адресной строки нельзя ни отвергать молча, ни брать
 * как есть: `pl-7k42` и `PL-7K42` обязаны дать одну и ту же смену, а
 * произвольный текст должен остаться воспроизводимым, а не сломать смену.
 * Поэтому регистр приводится всегда, а непохожий на код текст просто
 * обрезается и используется как есть — генератор принимает любую строку.
 */
export function normalizeSeed(raw: string): string {
  const trimmed = raw.trim().toUpperCase().slice(0, 32)
  if (trimmed.length === 0) return `${SEED_PREFIX}0000`
  if (isCanonicalSeed(trimmed)) return trimmed
  return trimmed
}
