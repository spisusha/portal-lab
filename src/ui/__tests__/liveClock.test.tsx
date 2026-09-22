// @vitest-environment jsdom
/**
 * Живое время смены.
 *
 * Всё здесь идёт на поддельных таймерах: ни один тест не ждёт настоящую
 * минуту. Это не удобство, а требование — иначе проверка «через 60 секунд
 * произошёл ровно один переход» стоила бы минуту реального времени и
 * зависела бы от загрузки машины.
 *
 * Проверяется именно адаптер, а не домен: домен об отсчёте не знает и
 * получает ту же команду `NEXT_CYCLE`, что и от кнопки учебного режима.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppRoot } from '../../AppRoot'
import { ONBOARDING_STORAGE_KEY } from '../Onboarding'
import { CYCLE_REAL_MS, MINUTE_REAL_MS } from '../../state/liveClock'

const SEED = 'PL-7K42'

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
  window.history.replaceState(null, '', '/')
  // Подделываются только те часы, которыми пользуется таймер смены.
  // Полная подмена ломает Testing Library: её асинхронная обёртка ждёт
  // настоящий `setTimeout`, который под поддельными часами никто не крутит,
  // и любой `user.click` виснет до таймаута теста.
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
  setVisibility('visible')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
})

function setup() {
  return userEvent.setup({ delay: null })
}

function openLive(seed = SEED) {
  window.history.replaceState(null, '', `/?mode=live&seed=${seed}`)
  return render(<AppRoot />)
}

/** Прокрутить виртуальное время внутри act: иначе React ругается на setState. */
function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function clockText(): string {
  const node = document.querySelector('.topbar__clock-value')
  return node?.textContent ?? ''
}

function countdown(): string {
  const node = document.querySelector('.livetime__value')
  return node?.textContent ?? ''
}

/** jsdom не умеет менять видимость вкладки сам: подменяем свойство. */
function setVisibility(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => value,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

async function start(user: ReturnType<typeof setup>) {
  await user.click(screen.getByRole('button', { name: 'Начать живую смену' }))
}

describe('запуск таймера', () => {
  it('до нажатия «Начать живую смену» время стоит', async () => {
    openLive()

    expect(screen.getByText(/Смена ещё не началась/)).toBeTruthy()
    expect(clockText()).toBe('08:00')

    tick(5 * CYCLE_REAL_MS)

    expect(clockText()).toBe('08:00')
    expect(screen.getByRole('heading', { name: 'Очередь порталов — 5' })).toBeTruthy()
    expect(screen.getByText('Цикл 1 из 6')).toBeTruthy()
  })

  it('после запуска лабораторное время идёт поминутно', async () => {
    const user = setup()
    openLive()
    await start(user)

    expect(clockText()).toBe('08:00')
    expect(countdown()).toBe('01:00')

    tick(MINUTE_REAL_MS)
    expect(clockText()).toBe('08:01')

    tick(MINUTE_REAL_MS)
    expect(clockText()).toBe('08:02')

    tick(MINUTE_REAL_MS * 5)
    expect(clockText()).toBe('08:07')
    expect(countdown()).toBe('00:32')
  })

  it('через 60 виртуальных секунд проходит ровно один цикл', async () => {
    const user = setup()
    openLive()
    await start(user)

    tick(CYCLE_REAL_MS)

    expect(clockText()).toBe('08:15')
    expect(screen.getByText('Цикл 2 из 6')).toBeTruthy()
    expect(countdown()).toBe('01:00')

    tick(CYCLE_REAL_MS)

    expect(clockText()).toBe('08:30')
    expect(screen.getByText('Цикл 3 из 6')).toBeTruthy()
  })

  it('обещание прогноза совпадает с тем, что случилось после перехода', async () => {
    const user = setup()
    openLive()

    const promise = document.querySelector('.cycle__forecast')?.textContent ?? ''
    const parsed = /состояние «(.+?)»: риск (\d+) → (\d+)/.exec(promise)
    expect(parsed).toBeTruthy()
    const [, name, , after] = parsed as RegExpExecArray

    await start(user)
    tick(CYCLE_REAL_MS)

    const queue = screen.getByRole('heading', { name: /Очередь порталов/ }).parentElement!
    expect(
      within(queue).getByRole('button', {
        name: new RegExp(`${name}\\. Ранг [EDCBAS], риск ${after} из 100`),
      }),
    ).toBeTruthy()
  })
})

describe('управление временем', () => {
  it('пауза останавливает отсчёт', async () => {
    const user = setup()
    openLive()
    await start(user)

    tick(20_000)
    expect(countdown()).toBe('00:40')

    await user.click(screen.getByRole('button', { name: 'Пауза' }))
    tick(5 * CYCLE_REAL_MS)

    expect(countdown()).toBe('00:40')
    expect(clockText()).toBe('08:05')
    expect(screen.getByText('Таймер остановлен вручную.')).toBeTruthy()
  })

  it('продолжение доигрывает остаток, а не заводит второй таймер', async () => {
    const user = setup()
    openLive()
    await start(user)

    tick(20_000)
    await user.click(screen.getByRole('button', { name: 'Пауза' }))
    await user.click(screen.getByRole('button', { name: 'Продолжить' }))

    // Осталось 40 секунд: 39 из них цикл ещё держится.
    tick(39_000)
    expect(clockText()).toBe('08:14')
    expect(screen.getByText('Цикл 1 из 6')).toBeTruthy()

    tick(1_000)
    expect(clockText()).toBe('08:15')
    expect(screen.getByText('Цикл 2 из 6')).toBeTruthy()

    // Второго таймера нет: следующий переход тоже ровно через минуту.
    tick(CYCLE_REAL_MS - 1_000)
    expect(screen.getByText('Цикл 2 из 6')).toBeTruthy()
    tick(1_000)
    expect(screen.getByText('Цикл 3 из 6')).toBeTruthy()
  })

  it('«Завершить цикл сейчас» делает один переход и начинает отсчёт заново', async () => {
    const user = setup()
    openLive()
    await start(user)

    tick(20_000)
    await user.click(screen.getByRole('button', { name: 'Завершить цикл сейчас' }))

    expect(clockText()).toBe('08:15')
    expect(screen.getByText('Цикл 2 из 6')).toBeTruthy()
    expect(countdown()).toBe('01:00')
  })

  it('совпадение отсчёта и нажатия не даёт двух переходов', async () => {
    const user = setup()
    openLive()
    await start(user)

    // Остаётся один шаг опроса: нажатие и истечение отсчёта приходятся
    // на один и тот же момент.
    tick(CYCLE_REAL_MS - 250)
    expect(screen.getByText('Цикл 1 из 6')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Завершить цикл сейчас' }))
    tick(250)

    expect(clockText()).toBe('08:15')
    expect(screen.getByText('Цикл 2 из 6')).toBeTruthy()
  })
})

describe('автоматическая пауза', () => {
  it('инструкция останавливает время и отпускает его после закрытия', async () => {
    const user = setup()
    openLive()
    await start(user)
    tick(20_000)

    await user.click(screen.getByRole('button', { name: 'Как это работает' }))
    expect(
      screen.getByText('Таймер приостановлен, пока открыта инструкция.'),
    ).toBeTruthy()

    tick(5 * CYCLE_REAL_MS)
    expect(countdown()).toBe('00:40')
    expect(clockText()).toBe('08:05')

    await user.keyboard('{Escape}')
    // Инструкция закрыта — время продолжается само, нажимать ничего не надо.
    tick(10_000)
    expect(countdown()).toBe('00:30')
  })

  it('подтверждение закрытия портала останавливает время', async () => {
    const user = setup()
    openLive()
    await start(user)

    const close = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.startsWith('Закрыть портал'))
    await user.click(close as HTMLElement)

    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(
      screen.getByText('Таймер приостановлен, пока открыто подтверждение.'),
    ).toBeTruthy()

    tick(5 * CYCLE_REAL_MS)
    expect(clockText()).toBe('08:00')
    expect(screen.getByText('Цикл 1 из 6')).toBeTruthy()
  })

  it('вкладка AI Worklog останавливает время', async () => {
    const user = setup()
    openLive()
    await start(user)
    tick(20_000)

    await user.click(screen.getByRole('button', { name: 'AI Worklog' }))
    tick(5 * CYCLE_REAL_MS)

    await user.click(screen.getByRole('button', { name: 'Лаборатория' }))
    expect(clockText()).toBe('08:05')
    expect(countdown()).toBe('00:40')
  })

  it('скрытая вкладка останавливает время и требует «Продолжить»', async () => {
    const user = setup()
    openLive()
    await start(user)
    tick(20_000)

    act(() => setVisibility('hidden'))
    expect(screen.getByText('Таймер приостановлен: вкладка неактивна.')).toBeTruthy()

    // Пропущенное в фоне время не применяется: ни один портал не схлопнется,
    // пока человек читает почту в соседней вкладке.
    tick(10 * CYCLE_REAL_MS)
    act(() => setVisibility('visible'))

    expect(clockText()).toBe('08:05')
    expect(countdown()).toBe('00:40')
    expect(screen.getByText('Цикл 1 из 6')).toBeTruthy()

    // Само по себе возвращение время не запускает.
    tick(CYCLE_REAL_MS)
    expect(clockText()).toBe('08:05')

    await user.click(screen.getByRole('button', { name: 'Продолжить' }))
    tick(40_000)
    expect(clockText()).toBe('08:15')
  })
})

describe('границы режима', () => {
  it('переключение на учебный сценарий убирает таймер и возвращает кнопку цикла', async () => {
    const user = setup()
    openLive()
    await start(user)
    tick(20_000)

    await user.selectOptions(screen.getByLabelText('Режим смены'), 'standard')

    expect(screen.queryByRole('button', { name: 'Пауза' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Завершить цикл сейчас' })).toBeNull()
    expect(screen.getByRole('button', { name: /Следующий цикл · \+15 мин/ })).toBeTruthy()

    tick(10 * CYCLE_REAL_MS)
    expect(clockText()).toBe('08:00')
  })

  it('учебный сценарий двигает время только кнопкой', async () => {
    const user = setup()
    render(<AppRoot />)

    expect(screen.queryByText(/Смена ещё не началась/)).toBeNull()
    tick(10 * CYCLE_REAL_MS)
    expect(clockText()).toBe('08:00')

    await user.click(screen.getByRole('button', { name: /Следующий цикл · \+15 мин/ }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: /перейти к циклу/,
      }),
    )
    expect(clockText()).toBe('08:15')
  })

  it('после шестого цикла время окончательно останавливается', async () => {
    const user = setup()
    openLive()
    await start(user)

    for (let i = 0; i < 6; i++) tick(CYCLE_REAL_MS)

    expect(screen.getByRole('region', { name: 'Смена завершена' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Пауза' })).toBeNull()

    const finished = clockText()
    tick(10 * CYCLE_REAL_MS)
    expect(clockText()).toBe(finished)
  })

  it('повтор смены не оставляет второй таймер', async () => {
    const user = setup()
    openLive()
    await start(user)
    for (let i = 0; i < 6; i++) tick(CYCLE_REAL_MS)

    await user.click(screen.getByRole('button', { name: 'Повторить эту смену' }))

    // Новая смена стоит на месте, пока её не запустят.
    expect(clockText()).toBe('08:00')
    tick(3 * CYCLE_REAL_MS)
    expect(clockText()).toBe('08:00')

    await start(user)
    tick(CYCLE_REAL_MS)
    // Ровно один переход, а не два от двух живых интервалов.
    expect(clockText()).toBe('08:15')
  })
})
