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
import { ONBOARDING_STORAGE_KEY } from '../Onboarding'

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
    expect(screen.getByText(/нейтральные живые обитатели/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Далее' }))
    expect(screen.getByText(/Сначала прочитайте состояние/)).toBeTruthy()
    expect(screen.getByText(/стабильность, энергию, время и существ/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Далее' }))
    expect(screen.getByText(/Одно решение за цикл/)).toBeTruthy()
    expect(screen.getByText(/рекомендация помогает, но не командует/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Далее' }))
    expect(screen.getByText(/Шесть циклов до итога/)).toBeTruthy()
    expect(screen.getByText(/избежать аварий и уберечь существ/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Начать смену' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe('1')
  })

  it('старый ключ не блокирует новую версию вступления', () => {
    localStorage.setItem('portal-lab:onboarded', '1')
    renderApp()

    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('сохранённый ключ v3 отключает авто-показ, но не ручную кнопку', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
    const first = renderApp()
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Как это работает' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    first.unmount()
  })

  it('цель смены видна на экране постоянно, а не только во вступлении', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    expect(
      screen.getByText(/Сохраните ценные порталы и не допустите аварий/i),
    ).toBeTruthy()
  })
})

describe('центральная камера портала', () => {
  it('сам выбирает самый опасный портал и объясняет выбор', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    const focus = screen.getByRole('region', {
      name: 'Врата №19 — Полая звезда',
    })

    // В штатной смене самый опасный — «Полая звезда», риск 72 (ранг A).
    expect(within(focus).getByText('Врата №19 — Полая звезда')).toBeTruthy()
    expect(within(focus).getByText(/Самый опасный из 5 открытых/)).toBeTruthy()
  })

  it('главная кнопка выполняет действие и риск снижается', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    const focus = screen.getByRole('region', {
      name: 'Врата №19 — Полая звезда',
    })
    expect(within(focus).getByRole('img', { name: /Риск 72 из 100/ })).toBeTruthy()

    await user.click(within(focus).getByRole('button', { name: 'Стабилизировать' }))

    // После решения камера автоматически переходит к следующему порталу,
    // а изменение по исходному порталу остаётся в заметной обратной связи.
    expect(screen.getByRole('region', { name: 'Врата №11 — Стеклянная арка' })).toBeTruthy()

    // Результат виден сразу, без поиска записи в журнале.
    const feedback = screen.getByRole('status')
    expect(within(feedback).getByText(/Риск 72/)).toBeTruthy()
    expect(within(feedback).getByText(/Стабильность 30/)).toBeTruthy()

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
      screen.getByLabelText('Режим смены'),
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
    expect(screen.getByRole('heading', { name: 'Очередь порталов — 5' })).toBeTruthy()
  })
})

describe('ход времени', () => {
  it('цикл двигает часы и пишет в журнал', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    expect(screen.getByLabelText('Смена 08:00')).toBeTruthy()

    await user.click(
      screen.getByRole('button', { name: /Следующий цикл/ }),
    )

    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: /перейти к циклу/ }))
    expect(screen.getByLabelText('Смена 08:15')).toBeTruthy()
    expect(screen.getByText(/Цикл наблюдения завершён/)).toBeTruthy()
  })
})

describe('клавиатура', () => {
  it('удерживает Tab внутри onboarding и возвращает фокус после закрытия', async () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
    const user = userEvent.setup()
    renderApp()

    const opener = screen.getByRole('button', { name: 'Как это работает' })
    opener.focus()
    await user.click(opener)

    const dialog = screen.getByRole('dialog')
    const skip = within(dialog).getByRole('button', { name: 'Пропустить' })
    const next = within(dialog).getByRole('button', { name: 'Далее' })
    next.focus()
    await user.tab()
    expect(document.activeElement).toBe(skip)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

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

    await user.selectOptions(screen.getByLabelText('Режим смены'), 'empty')

    expect(screen.getByRole('heading', { name: 'Лаборатория пуста' })).toBeTruthy()
    expect(screen.getByText('На начало смены активных порталов нет. Решения не требуются, смена завершена досрочно.')).toBeTruthy()

    expect(screen.queryByText('Отличная смена')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Начать смену заново' }))
    expect(screen.getByText(/Порталов в начале/)).toBeTruthy()
  })
})

describe('полный путь решения', () => {
  it('после стабилизации разрешает разведку и приносит отчёт через цикл', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    const observer = () =>
      screen.getByRole('button', { name: /Отправить наблюдателя/ })

    expect((observer() as HTMLButtonElement).disabled).toBe(true)
    await user.click(screen.getAllByRole('button', { name: 'Стабилизировать' })[0])
    // В том же цикле повторное решение запрещено; после перехода к новому
    // циклу разведка становится доступна.
    await user.click(screen.getByRole('button', { name: /Врата №19 — Полая звезда\. Ранг/ }))
    expect((screen.getAllByRole('button').find((button) => button.textContent?.includes('уже принято в текущем цикле')) as HTMLButtonElement).disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: /Следующий цикл/ }))
    const firstConfirm = screen.getByRole('alertdialog')
    await user.click(within(firstConfirm).getByRole('button', { name: /перейти к циклу/ }))
    await user.click(screen.getByRole('button', { name: /Врата №19 — Полая звезда\. Ранг/ }))
    expect((observer() as HTMLButtonElement).disabled).toBe(false)
    await user.click(observer())
    expect(screen.getByRole('status').textContent).toContain('Наблюдатель')
    expect(screen.getByText(/наблюдатель внутри/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Следующий цикл/ }))
    const cycleConfirm = screen.queryByRole('alertdialog')
    if (cycleConfirm) {
      await user.click(within(cycleConfirm).getByRole('button', { name: /перейти к циклу/ }))
    }
    expect(screen.getByText(/Наблюдатель вернулся: подтверждено существ/)).toBeTruthy()
  })

  it('ставит портал под вопрос и сразу показывает новый статус', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    await user.click(screen.getByRole('button', { name: /Пометить «под вопросом»/ }))

    expect(screen.getAllByText(/под вопросом/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('status').textContent).toContain('Под вопросом')
  })

  it('подтверждает опасное закрытие и убирает портал из активной очереди', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    await user.click(screen.getByRole('button', { name: /Закрыть портал/ }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Да, закрыть портал' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('Закрыт')
    expect(screen.getByText(/Опасных нет · активно 4/)).toBeTruthy()
  })
})

describe('прогноз и служебные разделы', () => {
  it('не называет A-ранг критическим в штатном сценарии', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    expect(screen.getByLabelText('1 опасный из 5 активных')).toBeTruthy()
    const status = screen.getByRole('region', { name: 'Состояние лаборатории' })
    expect(status.textContent).toContain('0критических')
  })

  it('после завершения показывает состояние смены вместо прогноза и кнопки', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)
    await user.selectOptions(screen.getByLabelText('Режим смены'), 'empty')

    expect(screen.getAllByText('Смена завершена').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /Следующий цикл/ })).toBeNull()
    expect(screen.queryByText('Через цикл')).toBeNull()
  })

  it('перезапуск не показывает ложное изменение «Схлопнулся → Открыт»', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)
    await user.selectOptions(screen.getByLabelText('Режим смены'), 'critical')
    await user.click(screen.getByRole('button', { name: /Следующий цикл/ }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: /перейти к циклу/,
      }),
    )
    await user.selectOptions(screen.getByLabelText('Режим смены'), 'standard')

    expect(screen.queryByText(/Схлопнулся.*Открыт/)).toBeNull()
  })

  it('до цикла предупреждает, какой портал станет опаснее', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    expect(screen.getByText(/Сильнее всех просядет «Врата №19/)).toBeTruthy()
    expect(screen.getAllByText(/риск 72 → 76/).length).toBeGreaterThan(0)
  })

  it('критический сценарий предупреждает о предстоящем схлопывании', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    await user.selectOptions(screen.getByLabelText('Режим смены'), 'critical')
    expect(screen.getByText(/схлопнется «Врата №14 — Последний маяк»/)).toBeTruthy()

    // Предупреждение не блокирует демонстрацию последствия.
    await user.click(screen.getByRole('button', { name: /Следующий цикл/ }))
    const confirm = screen.getByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: /перейти к циклу/ }))
    const feedback = screen.getByRole('status')
    expect(feedback.textContent).toContain('Врата №14 — Последний маяк')
    expect(feedback.textContent).toContain('Схлопнулся')
  })

  it('открывает читаемый AI Worklog с содержанием и незаполненными полями', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    await user.click(screen.getByRole('button', { name: 'AI Worklog' }))

    expect(screen.getByRole('heading', { name: 'AI Worklog' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Разделы отчёта' })).toBeTruthy()
    expect(screen.getByText('Общее время разработки')).toBeTruthy()
    expect(screen.getByText('Израсходовано токенов')).toBeTruthy()
  })

  // Активная вкладка должна читаться не только глазами: состояние идёт
  // в aria-current, а подсветка — отдельным классом на самой кнопке.
  it('помечает активную вкладку и переключает её обратно', async () => {
    const user = userEvent.setup()
    renderApp()
    await skipIntro(user)

    const tabs = screen.getByRole('navigation', { name: 'Разделы' })
    const lab = within(tabs).getByRole('button', { name: 'Лаборатория' })
    const worklog = within(tabs).getByRole('button', { name: 'AI Worklog' })

    expect(lab.getAttribute('aria-current')).toBe('true')
    expect(lab.className).toContain('tab--active')
    expect(worklog.className).not.toContain('tab--active')

    await user.click(worklog)
    expect(worklog.getAttribute('aria-current')).toBe('true')
    expect(worklog.className).toContain('tab--active')
    expect(lab.className).not.toContain('tab--active')

    await user.click(lab)
    expect(lab.className).toContain('tab--active')
    expect(worklog.className).not.toContain('tab--active')
  })
})
