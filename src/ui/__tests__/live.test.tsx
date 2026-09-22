// @vitest-environment jsdom
/**
 * Живая смена глазами человека.
 *
 * Доменные тесты уже доказали, что генератор воспроизводим, а прогноз
 * события совпадает с фактом. Здесь проверяется другое: видит ли это всё
 * пользователь — особенность мира до решения, директиву рядом с прогрессом,
 * событие в прогнозе и в журнале, итог со счётом и ссылку в буфере.
 *
 * Все проверки идут на одном коде смены, открытом ссылкой: так тест
 * не зависит от того, что выпадет `crypto.getRandomValues`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppRoot } from '../../AppRoot'
import { ONBOARDING_STORAGE_KEY } from '../Onboarding'
import { createLiveShift } from '../../domain/live/generator'

/** Смена, на которой держатся все проверки ниже. */
const SEED = 'PL-7K42'
const SHIFT = createLiveShift(SEED)

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
  localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

function renderApp() {
  return render(<AppRoot />)
}

/**
 * Карточка режима — место, где код смены показан как код, а не как пример
 * в тексте. FAQ внизу страницы тоже упоминает `PL-7K42`, поэтому искать
 * код по всему экрану нельзя.
 */
function modeCard() {
  return screen.getByRole('region', { name: /Выбранный режим/ })
}

function openByLink(seed = SEED) {
  window.history.replaceState(null, '', `/?mode=live&seed=${seed}`)
  return renderApp()
}

/**
 * Перейти к следующему циклу.
 *
 * В живой смене время идёт само, поэтому кнопки «Следующий цикл» здесь нет:
 * тот же доменный переход запускает «Завершить цикл сейчас». Ждать
 * настоящую минуту в этих тестах незачем — отсчёт проверяется отдельно,
 * в `liveClock.test.tsx`.
 */
async function advance(user: ReturnType<typeof userEvent.setup>) {
  const start = screen.queryByRole('button', { name: 'Начать живую смену' })
  if (start) await user.click(start)
  await user.click(screen.getByRole('button', { name: 'Завершить цикл сейчас' }))
}

describe('запуск живой смены', () => {
  it('добавлен в переключатель, но не вытеснил три демонстрационных режима', () => {
    renderApp()
    const picker = screen.getByLabelText('Режим смены') as HTMLSelectElement
    expect([...picker.options].map((option) => option.text)).toEqual([
      'Штатный режим',
      'Критическая ситуация',
      'Пустая лаборатория',
      'Живая смена',
    ])
    // По умолчанию открывается штатный демонстрационный режим.
    expect(picker.value).toBe('standard')
  })

  it('выбор живой смены выдаёт новый код и ставит его в адресную строку', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.selectOptions(screen.getByLabelText('Режим смены'), 'live')

    const code = within(modeCard()).getByText(/^PL-[234679ACDEFGHJKLMNPQRTUVWXYZ]{4}$/)
    expect(code).toBeTruthy()
    expect(window.location.search).toBe(`?mode=live&seed=${code.textContent}`)
  })

  // Требование 10 чеклиста, со стороны интерфейса.
  it('ссылка с кодом открывает ту же смену, что и домен', () => {
    openByLink()

    expect(within(modeCard()).getByText(SEED)).toBeTruthy()
    for (const portal of SHIFT.portals) {
      expect(screen.getByRole('button', { name: new RegExp(portal.name) })).toBeTruthy()
    }
    expect(screen.getByRole('heading', { name: 'Очередь порталов — 5' })).toBeTruthy()
  })

  it('возврат к демонстрационному режиму убирает код из адресной строки', async () => {
    const user = userEvent.setup()
    openByLink()
    expect(window.location.search).toContain('mode=live')

    await user.selectOptions(screen.getByLabelText('Режим смены'), 'standard')
    expect(window.location.search).toBe('')
    expect(screen.getByRole('button', { name: /Врата №19 — Полая звезда/ })).toBeTruthy()
  })
})

describe('режимы разведены по смыслу', () => {
  it('список разделён на учебные сценарии и основной режим', () => {
    renderApp()
    const picker = screen.getByLabelText('Режим смены') as HTMLSelectElement
    const groups = [...picker.querySelectorAll('optgroup')]

    expect(groups.map((group) => group.label)).toEqual([
      'Учебные сценарии',
      'Основной режим',
    ])
    expect([...groups[0].children].map((option) => option.textContent)).toEqual([
      'Штатный режим',
      'Критическая ситуация',
      'Пустая лаборатория',
    ])
    expect([...groups[1].children].map((option) => option.textContent)).toEqual([
      'Живая смена',
    ])
  })

  it('под переключателем объясняет выбранный сценарий и меняется вместе с ним', async () => {
    const user = userEvent.setup()
    renderApp()

    const standard = screen.getByRole('region', {
      name: 'Выбранный режим: Штатный режим',
    })
    expect(within(standard).getByText('Учебный сценарий')).toBeTruthy()
    expect(
      within(standard).getByText(/Подготовленная тренировочная смена/),
    ).toBeTruthy()
    expect(
      within(standard).getByRole('button', { name: 'Перейти в живую смену' }),
    ).toBeTruthy()

    await user.selectOptions(screen.getByLabelText('Режим смены'), 'critical')
    const critical = screen.getByRole('region', {
      name: 'Выбранный режим: Критическая ситуация',
    })
    // Критическая ситуация — заготовленный пример, а не отдельная сложность.
    expect(within(critical).getByText('Учебный сценарий')).toBeTruthy()
    expect(
      within(critical).getByText(/Подготовленный аварийный сценарий/),
    ).toBeTruthy()

    await user.selectOptions(screen.getByLabelText('Режим смены'), 'empty')
    expect(
      screen.getByText(/Демонстрация завершённого состояния/),
    ).toBeTruthy()
  })

  it('кнопка «Перейти в живую смену» уводит из учебного сценария', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Перейти в живую смену' }))

    const live = screen.getByRole('region', { name: /Выбранный режим: Уникальная смена/ })
    expect(within(live).getByText('Живая смена')).toBeTruthy()
    expect(within(live).getByText(/сформированы по коду смены/)).toBeTruthy()
    expect(
      within(live).getByRole('button', { name: 'Начать живую смену' }),
    ).toBeTruthy()
    expect(window.location.search).toMatch(/^\?mode=live&seed=PL-/)
  })

  it('живая смена подписана кодом, а учебные сценарии кнопкой цикла', async () => {
    const user = userEvent.setup()
    openByLink()

    const live = screen.getByRole('region', { name: /Выбранный режим: Уникальная смена/ })
    expect(within(live).getByText(SEED)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Следующий цикл/ })).toBeNull()

    await user.selectOptions(screen.getByLabelText('Режим смены'), 'standard')
    expect(screen.getByRole('button', { name: /Следующий цикл · \+15 мин/ })).toBeTruthy()
    expect(screen.queryByText(/Смена ещё не началась/)).toBeNull()
  })
})

describe('особенность мира видна до решения', () => {
  it('стоит рядом с названием мира в камере портала', () => {
    openByLink()

    // Очередь выбирает самый опасный портал — «Тихий разлом», мир
    // «Ледяные чертоги» с особенностью «Морозный контур».
    const camera = screen.getByRole('region', { name: 'Врата №14 — Тихий разлом' })
    expect(within(camera).getByText('Ледяные чертоги')).toBeTruthy()
    expect(within(camera).getByText('Морозный контур')).toBeTruthy()
    expect(
      within(camera).getByText(/контур проседает медленнее .−1 за цикл., но стабилизация даёт только \+15/),
    ).toBeTruthy()
  })

  it('видна и в очереди, где портал выбирают', () => {
    openByLink()
    const queue = screen.getByRole('heading', { name: /Очередь порталов/ }).parentElement!
    expect(within(queue).getByText('Топь тянет вниз')).toBeTruthy()
    expect(within(queue).getByText('Разлом Аркхан')).toBeTruthy()
  })

  it('обещанное число действительно применяется к порталу', async () => {
    const user = userEvent.setup()
    openByLink()

    // «Морозный контур» поднимает стабильность на 15, а не на обычные 25:
    // последствие обещано на кнопке ещё до нажатия.
    const bench = screen.getByRole('region', {
      name: 'Решение по порталу «Врата №14 — Тихий разлом»',
    })
    expect(within(bench).getByText(/Стабильность 38 → 53/)).toBeTruthy()

    const camera = screen.getByRole('region', { name: 'Врата №14 — Тихий разлом' })
    await user.click(within(camera).getByRole('button', { name: 'Стабилизировать' }))
    const feedback = screen.getByRole('status')
    expect(feedback.textContent).toContain('53')
  })

  it('у демонстрационных сценариев особенностей нет', async () => {
    const user = userEvent.setup()
    openByLink()
    expect(screen.getAllByText('Морозный контур').length).toBeGreaterThan(0)

    await user.selectOptions(screen.getByLabelText('Режим смены'), 'standard')
    expect(screen.queryByText('Морозный контур')).toBeNull()
    expect(screen.queryByText('Топь тянет вниз')).toBeNull()
  })
})

describe('директива смены', () => {
  it('показана рядом с прогрессом и не заводит отдельной панели', () => {
    openByLink()
    const directive = screen.getByLabelText(
      'Директива смены: Сохранить открытыми минимум 3 портала',
    )
    expect(directive.textContent).toContain('Сохранить открытыми минимум 3 портала')
    expect(directive.textContent).toContain('оставшиеся активными к концу смены')
  })

  it('у демонстрационных сценариев директивы нет', async () => {
    const user = userEvent.setup()
    openByLink()
    await user.selectOptions(screen.getByLabelText('Режим смены'), 'critical')
    expect(screen.queryByText(/^Директива/)).toBeNull()
  })
})

describe('событие между циклами', () => {
  it('объявлено в блоке «Через цикл» заранее, без всплывающих окон', async () => {
    const user = userEvent.setup()
    openByLink()

    // Первый переход всегда тихий: человеку дают осмотреться.
    expect(screen.queryByText(/Энергетический всплеск/)).toBeNull()
    await advance(user)

    expect(screen.getByText('Энергетический всплеск')).toBeTruthy()
    expect(
      screen.getByText(/Энергетический всплеск в «Врата №9 — Стеклянная арка»: энергия \+15/),
    ).toBeTruthy()
    // Никаких модальных окон объявление не открывает.
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('после перехода видно, что именно изменилось, и это попадает в журнал', async () => {
    const user = userEvent.setup()
    openByLink()
    await advance(user)
    await advance(user)

    // Энергия «Стеклянной арки»: 60 → 62 за цикл → 77 после всплеска.
    expect(screen.getByText(/Энергетический всплеск в «Врата №9 — Стеклянная арка»: энергия 64 → 79/))
      .toBeTruthy()
  })
})

describe('итог живой смены', () => {
  async function playToEnd(user: ReturnType<typeof userEvent.setup>) {
    for (let i = 0; i < 6; i++) await advance(user)
  }

  it('показывает счёт, ранг, разбор по блокам и результат директивы', async () => {
    const user = userEvent.setup()
    openByLink()
    await playToEnd(user)

    const report = screen.getByRole('region', { name: 'Смена завершена' })
    expect(within(report).getByText(/из 100/)).toBeTruthy()

    for (const block of [
      'Безопасность существ',
      'Сохранность порталов',
      'Научные данные',
      'Директива смены',
    ]) {
      expect(within(report).getByText(block)).toBeTruthy()
    }

    expect(
      within(report).getByText(/Директива (выполнена|не выполнена)/),
    ).toBeTruthy()
    expect(within(report).getByText('Из чего сложился результат')).toBeTruthy()
  })

  it('показывает разбор решений и не называет рекомендацию единственно верной', async () => {
    const user = userEvent.setup()
    openByLink()

    const camera = screen.getByRole('region', { name: 'Врата №14 — Тихий разлом' })
    await user.click(within(camera).getByRole('button', { name: 'Стабилизировать' }))
    await playToEnd(user)

    const report = screen.getByRole('region', { name: 'Смена завершена' })
    expect(within(report).getByText('Разбор решений')).toBeTruthy()
    expect(within(report).getByText('Цикл 1')).toBeTruthy()
    expect(within(report).getByText(/Врата №14 — Тихий разлом/)).toBeTruthy()
    expect(within(report).getByText(/Система предлагала/)).toBeTruthy()
    expect(report.textContent).not.toMatch(/идеальн|единственно правильн/i)
  })

  it('повторяет ту же смену и заводит новую другим кодом', async () => {
    const user = userEvent.setup()
    openByLink()
    await playToEnd(user)

    await user.click(screen.getByRole('button', { name: 'Повторить эту смену' }))
    expect(within(modeCard()).getByText(SEED)).toBeTruthy()
    expect(window.location.search).toBe(`?mode=live&seed=${SEED}`)
    expect(screen.getByRole('button', { name: new RegExp(SHIFT.portals[0].name) })).toBeTruthy()
    expect(screen.getByLabelText('Смена 08:00')).toBeTruthy()

    await playToEnd(user)
    await user.click(screen.getByRole('button', { name: 'Новая живая смена' }))
    const code = within(modeCard()).getByText(/^PL-[234679ACDEFGHJKLMNPQRTUVWXYZ]{4}$/)
    expect(code.textContent).not.toBe(SEED)
    expect(window.location.search).toBe(`?mode=live&seed=${code.textContent}`)
  })

  it('копирует ссылку и подтверждает это текстом', async () => {
    // Буфер обмена здесь настоящий — тот, что подставляет userEvent.
    // Собственный шпион был бы бесполезен: setup() всё равно заменяет
    // navigator.clipboard своей заглушкой.
    const user = userEvent.setup()
    openByLink()
    await playToEnd(user)

    await user.click(screen.getByRole('button', { name: 'Поделиться сменой' }))

    expect(await navigator.clipboard.readText()).toContain(
      `?mode=live&seed=${SEED}`,
    )
    const status = screen
      .getAllByRole('status')
      .find((node) => node.textContent?.includes('Ссылка скопирована'))
    expect(status).toBeTruthy()
  })

  it('демонстрационный итог остался прежним и без счёта', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.selectOptions(screen.getByLabelText('Режим смены'), 'empty')

    expect(screen.getByRole('heading', { name: 'Лаборатория пуста' })).toBeTruthy()
    expect(screen.queryByText('Из чего сложился результат')).toBeNull()
    expect(screen.queryByText('Разбор решений')).toBeNull()
  })
})

describe('живая смена завершается вовремя', () => {
  // Требование 15 чеклиста, со стороны интерфейса.
  it('досрочно, если активных порталов не осталось', async () => {
    const user = userEvent.setup()
    openByLink()

    for (let i = 0; i < SHIFT.portals.length; i++) {
      const close = screen
        .getAllByRole('button')
        .find((button) => button.textContent?.startsWith('Закрыть портал'))
      if (!close) break
      await user.click(close)
      const dialog = screen.queryByRole('alertdialog')
      if (dialog) {
        await user.click(within(dialog).getByRole('button', { name: 'Да, закрыть портал' }))
      }
    }

    expect(screen.getByRole('region', { name: 'Смена завершена' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Следующий цикл/ })).toBeNull()
  })
})
