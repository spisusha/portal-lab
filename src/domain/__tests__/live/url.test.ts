/**
 * Ссылка на смену и код смены.
 *
 * Требование 10 чеклиста: URL с seed восстанавливает ту же смену. Проверяется
 * не «параметр разобрался», а именно то, ради чего ссылка существует, —
 * лаборатория из ссылки совпадает с исходной вплоть до расписания событий.
 */
import { describe, expect, it } from 'vitest'
import {
  buildShiftSearch,
  buildShiftUrl,
  parseShiftLink,
} from '../../live/url'
import {
  SEED_ALPHABET,
  SEED_BODY_LENGTH,
  formatSeed,
  isCanonicalSeed,
  normalizeSeed,
} from '../../live/seedCode'
import { createLiveShift } from '../../live/generator'
import { createScenario } from '../../seed'
import { seedSample } from './helpers'

describe('код смены', () => {
  it('не содержит символов, которые путаются при чтении с экрана', () => {
    for (const ambiguous of ['0', 'O', '1', 'I', '5', 'S', '8', 'B']) {
      expect(SEED_ALPHABET).not.toContain(ambiguous)
    }
    expect(SEED_BODY_LENGTH).toBe(4)
  })

  it('приводит регистр и пробелы к каноническому виду', () => {
    expect(normalizeSeed(' pl-7k42 ')).toBe('PL-7K42')
    expect(formatSeed('7k42')).toBe('PL-7K42')
    expect(isCanonicalSeed('PL-7K42')).toBe(true)
    expect(isCanonicalSeed('PL-7K4')).toBe(false)
    expect(isCanonicalSeed('7K42')).toBe(false)
  })

  it('не падает на пустой или чужой строке', () => {
    expect(normalizeSeed('')).toBeTruthy()
    expect(createLiveShift(normalizeSeed('что-то своё')).portals).toHaveLength(5)
  })
})

describe('ссылка на смену', () => {
  it('собирает понятный параметр и разбирает его обратно', () => {
    expect(buildShiftSearch('PL-7K42')).toBe('?mode=live&seed=PL-7K42')
    expect(parseShiftLink('?mode=live&seed=PL-7K42')).toEqual({ seed: 'PL-7K42' })
    expect(parseShiftLink('mode=live&seed=PL-7K42')).toEqual({ seed: 'PL-7K42' })
  })

  it('учитывает base path GitHub Pages и не подставляет корень', () => {
    expect(buildShiftUrl('https://spisusha.github.io', '/portal-lab/', 'PL-7K42')).toBe(
      'https://spisusha.github.io/portal-lab/?mode=live&seed=PL-7K42',
    )
    expect(buildShiftUrl('http://localhost:5173/', '/portal-lab/', 'pl-7k42')).toBe(
      'http://localhost:5173/portal-lab/?mode=live&seed=PL-7K42',
    )
  })

  it('без mode=live или без seed живой режим не включается', () => {
    expect(parseShiftLink('')).toBeNull()
    expect(parseShiftLink('?seed=PL-7K42')).toBeNull()
    expect(parseShiftLink('?mode=live')).toBeNull()
    expect(parseShiftLink('?mode=live&seed=')).toBeNull()
    expect(parseShiftLink('?mode=demo&seed=PL-7K42')).toBeNull()
  })

  // Требование 10 чеклиста.
  it('ссылка восстанавливает ту же смену целиком', () => {
    for (const seed of seedSample(20)) {
      const original = createLiveShift(seed)
      const link = buildShiftUrl('https://spisusha.github.io', '/portal-lab/', seed)
      const parsed = parseShiftLink(link.slice(link.indexOf('?')))
      expect(parsed).not.toBeNull()

      const restored = createScenario('live', parsed!.seed)
      expect(restored.portals).toEqual(original.portals)
      expect(restored.live!.schedule).toEqual(original.live!.schedule)
      expect(restored.live!.directive).toEqual(original.live!.directive)
    }
  })

  it('ссылка с кодом в нижнем регистре открывает ту же смену', () => {
    const parsed = parseShiftLink('?mode=live&seed=pl-7k42')!
    expect(createScenario('live', parsed.seed).portals).toEqual(
      createLiveShift('PL-7K42').portals,
    )
  })
})
