/**
 * Русские числительные.
 *
 * Живёт в домене, а не в ui: объяснения итогов собирает домен, и они тоже
 * пишутся для человека — «Спасено 1 существ» выдаёт машину ровно так же,
 * как это делала шапка до версии 1.0.
 *
 * «1 критических из 5 открытых» — мелочь, но именно по таким строкам
 * видно, что текст собирала машина. Правило одно и хорошо известно:
 * 1 — одна форма, 2–4 — вторая, всё остальное и 11–14 — третья.
 */
export function plural(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const abs = Math.abs(count) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last > 1 && last < 5) return few
  if (last === 1) return one
  return many
}

/** Число вместе с подходящей формой слова: «3 записи». */
export function counted(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  return `${count} ${plural(count, one, few, many)}`
}
