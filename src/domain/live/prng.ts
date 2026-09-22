/**
 * Детерминированный генератор псевдослучайных чисел для «Живой смены».
 *
 * Правило домена не изменилось: неконтролируемой случайности здесь нет.
 * `Math.random` и `Date.now` по-прежнему запрещены — источником разброса
 * служит строка seed, которую домен получает снаружи уже готовой.
 * Один и тот же seed даёт одну и ту же последовательность чисел, поэтому
 * смена воспроизводится по ссылке и покрывается обычными тестами.
 *
 * Алгоритм — xmur3 (строка → 32-битное зерно) плюс mulberry32 (зерно →
 * поток чисел). Оба помещаются в десяток строк, не требуют зависимостей
 * и одинаково ведут себя в Node и в браузере: это важнее статистического
 * качества, которое здесь никому не нужно.
 */

/** Строка → 32-битное зерно. Разные строки почти всегда дают разные зёрна. */
export function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^= h >>> 16) >>> 0
}

/**
 * Поток чисел от одного зерна.
 *
 * Отдельный объект, а не глобальное состояние: у генератора смены,
 * у расписания событий и у выбора директивы свои потоки, и добавление
 * нового вызова в одном месте не должно сдвигать все остальные.
 */
export interface Random {
  /** Следующее число в диапазоне [0, 1). */
  next(): number
  /** Целое в диапазоне [min, max] включительно. */
  int(min: number, max: number): number
  /** Целое, кратное `step`, в диапазоне [min, max]. */
  step(min: number, max: number, step: number): number
  /** Случайный элемент непустого списка. */
  pick<T>(items: readonly T[]): T
  /** Копия списка в случайном порядке (перемешивание Фишера — Йетса). */
  shuffle<T>(items: readonly T[]): T[]
  /** Срабатывает с заданной вероятностью 0–1. */
  chance(probability: number): boolean
}

export function createRandom(seed: string, salt = ''): Random {
  let state = hashSeed(`${seed}::${salt}`)

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (min: number, max: number): number => {
    if (max <= min) return min
    return min + Math.floor(next() * (max - min + 1))
  }

  return {
    next,
    int,
    step(min, max, stepSize) {
      const steps = Math.floor((max - min) / stepSize)
      return min + int(0, steps) * stepSize
    },
    pick(items) {
      return items[int(0, items.length - 1)]
    },
    shuffle(items) {
      const copy = [...items]
      for (let i = copy.length - 1; i > 0; i--) {
        const j = int(0, i)
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
      }
      return copy
    },
    chance(probability) {
      return next() < probability
    },
  }
}
