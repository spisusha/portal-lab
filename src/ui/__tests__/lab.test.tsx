// @vitest-environment jsdom
/**
 * Интеграционные тесты интерфейса: проверяют путь пользователя целиком —
 * от вступления до последствий действия — а не отдельные функции.
 *
 * Доменные тесты отвечают на вопрос «правильно ли посчитано»,
 * эти — на вопрос «увидит ли человек результат и не упрётся ли в тупик».
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { LabProvider } from '../../state/labStore'

// jsdom не реализует прокрутку, а переход «Открыть карточку» её вызывает.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  localStorage.clear()
})

afterEach(cleanup)

function renderApp() {
  return render(
    <LabProvider>
      <App />
    </LabProvider>,
  )
}

/** Пройти вступление, как это делает человек при первом открытии. */
async function skipIntro(user: ReturnType<typeof userEvent.setup>) {
  const skip = screen.queryByRole('button', { name: 'Пропустить' })
  if (skip) await user.click(skip)
}

describe('первый запуск', () => {
  it('показывает вступление с ролью, циклом и целью', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/Вы — смотритель лаборатории/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Дальше' }))
    expect(screen.getByText(/Цикл работы/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Дальше' }))
    expect(screen.getByText(/не допустить схлопывания/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Заступить на смену' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('второй раз вступление само не открывается, но доступно по кнопке', async () => {
    const user = userEvent.setup()
    const first = renderApp()
    await skipIntro(user)
    first.unmount()

    renderApp()
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Как это работает' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('цель смены видна на экране постоянно, а не только во вступлении', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    expect(
      screen.getByText(/не допустить неконтролируемого\s+схлопывания/i),
    ).toBeTruthy()
  })
})

describe('блок «Требует решения сейчас»', () => {
  it('сам выбирает самый опасный портал и объясняет выбор', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    const focus = screen.getByLabelText<HTMLElement>('Требует решения сейчас', {
      selector: 'section',
    })

    // В штатной смене самый опасный — «Полая звезда», риск 72 (ранг A).
    expect(within(focus).getByText('Врата №19 — Полая звезда')).toBeTruthy()
    expect(within(focus).getByText(/Самый опасный из 5 открытых/)).toBeTruthy()
  })

  it('главная кнопка выполняет действие и риск снижается', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    const focus = screen.getByLabelText<HTMLElement>('Требует решения сейчас', {
      selector: 'section',
    })
    expect(within(focus).getByText(/риск 72 из 100/)).toBeTruthy()

    await user.click(within(focus).getByRole('button', { name: 'Стабилизировать' }))

    // После стабилизации риск падает 72 → 60, и это видно в том же блоке.
    const after = screen.getByLabelText<HTMLElement>('Требует решения сейчас', {
      selector: 'section',
    })
    expect(within(after).getByText(/риск 60 из 100/)).toBeTruthy()

    // И событие попало в журнал.
    expect(
      screen.getByText(/Стабилизация выполнена. Риск снижен с 72 до 60./),
    ).toBeTruthy()
  })
})

describe('запреты объясняются до нажатия', () => {
  it('при ранге S отправка наблюдателя недоступна, причина видна рядом', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    await user.selectOptions(
      screen.getByLabelText('Смена'),
      'critical',
    )

    const observer = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Отправить наблюдателя'))

    expect(observer).toBeTruthy()
    expect((observer as HTMLButtonElement).disabled).toBe(true)
    expect(observer?.textContent).toContain('отправка наблюдателя запрещена регламентом')
  })
})

describe('закрытие портала с существами внутри', () => {
  it('требует подтверждения и отменяется без последствий', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    const close = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.startsWith('Закрыть портал'))
    await user.click(close as HTMLElement)

    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/Закрытие отрежет их от пути домой/)).toBeTruthy()

    await user.click(within(dialog).getByRole('button', { name: 'Отмена' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    // Портал остался открытым: в сводке по-прежнему пять активных.
    expect(screen.getByText('Порталы — 5')).toBeTruthy()
  })
})

describe('ход времени', () => {
  it('цикл двигает часы и пишет в журнал', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    expect(screen.getByText('Смена 08:00')).toBeTruthy()

    await user.click(
      screen.getByRole('button', { name: /Следующий цикл/ }),
    )

    expect(screen.getByText('Смена 08:15')).toBeTruthy()
    expect(screen.getByText(/Цикл наблюдения завершён/)).toBeTruthy()
  })
})

describe('клавиатура', () => {
  it('до главных органов управления можно дойти табом', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    const reached: string[] = []
    for (let i = 0; i < 12; i++) {
      await user.tab()
      const active = document.activeElement
      if (active && active !== document.body) {
        reached.push((active.textContent || active.tagName).trim().slice(0, 40))
      }
    }

    const joined = reached.join(' | ')
    expect(joined).toContain('Как это работает')
    expect(joined).toContain('Следующий цикл')
    expect(joined).toContain('Лаборатория')
  })

  it('диалог подтверждения закрывается по Escape', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    const close = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.startsWith('Закрыть портал'))
    await user.click(close as HTMLElement)
    expect(screen.getByRole('alertdialog')).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('вступление закрывается по Escape и не запирает фокус', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(screen.getByRole('dialog')).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('пустая лаборатория', () => {
  it('не показывает пустой экран без объяснения и даёт выход', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    await user.selectOptions(screen.getByLabelText('Смена'), 'empty')

    expect(screen.getByText('В лаборатории нет активных порталов')).toBeTruthy()
    expect(screen.getByText(/Открытых порталов нет — решать нечего/)).toBeTruthy()

    await user.click(
      screen.getByRole('button', { name: 'Загрузить штатную смену' }),
    )
    expect(screen.getByText('Порталы — 5')).toBeTruthy()
  })
})
