import { useCallback, useEffect, useRef, useState } from 'react'
import { CYCLE_MINUTES } from '../domain/types'

const STORAGE_KEY = 'portal-lab:onboarded'

/**
 * Показывать ли вступление автоматически.
 *
 * Читаем localStorage через try/catch: в приватном режиме и в некоторых
 * встроенных браузерах обращение к нему бросает исключение, и падать
 * из-за подсказки приложение не должно.
 */
function wasOnboarded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function rememberOnboarded() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* Неважно: подсказку просто покажем снова в следующий раз. */
  }
}

/** Управление вступлением: авто-показ при первом визите + ручное открытие. */
export function useOnboarding() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!wasOnboarded()) setOpen(true)
  }, [])

  const close = useCallback(() => {
    rememberOnboarded()
    setOpen(false)
  }, [])

  return { open, close, show: () => setOpen(true) }
}

interface Step {
  title: string
  text: string
  glyph: 'watcher' | 'loop' | 'goal'
}

const STEPS: Step[] = [
  {
    title: 'Вы — смотритель лаборатории',
    text:
      'В лаборатории открываются порталы в другие миры. Часть из них держится ' +
      'штатно, часть теряет стабильность, а часть вот-вот схлопнется. Всю смену ' +
      'за ними следите только вы.',
    glyph: 'watcher',
  },
  {
    title: 'Цикл работы — четыре шага',
    text:
      'Выбрать портал в списке → изучить риск и причину → принять решение ' +
      `(стабилизировать, закрыть, отправить наблюдателя или пометить «под вопросом») → ` +
      `продвинуть время кнопкой «Следующий цикл» на ${CYCLE_MINUTES} минут.`,
    glyph: 'loop',
  },
  {
    title: 'Цель — не допустить схлопывания',
    text:
      'Схлопнувшийся портал — это провал смены, особенно если внутри остались ' +
      'существа. Время идёт только по вашей команде, но бездействие дорого: ' +
      'за каждый цикл порталы теряют стабильность и набирают энергию.',
    glyph: 'goal',
  },
]

export function Onboarding({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Фокус уводим в диалог, чтобы клавиатурная навигация не осталась
  // на фоне, а Esc закрывал вступление откуда угодно.
  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const last = step === STEPS.length - 1
  const current = STEPS[step]

  return (
    <div className="overlay" role="presentation">
      <div
        className="intro"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <StepGlyph kind={current.glyph} />

        <p className="intro__counter">
          Шаг {step + 1} из {STEPS.length}
        </p>
        <h2 className="intro__title" id="intro-title">
          {current.title}
        </h2>
        <p className="intro__text">{current.text}</p>

        <div className="intro__dots" aria-hidden="true">
          {STEPS.map((item, index) => (
            <span
              key={item.title}
              className={`intro__dot${index === step ? ' intro__dot--on' : ''}`}
            />
          ))}
        </div>

        <div className="intro__buttons">
          <button type="button" className="btn" onClick={onClose}>
            Пропустить
          </button>
          {step > 0 && (
            <button
              type="button"
              className="btn"
              onClick={() => setStep((s) => s - 1)}
            >
              Назад
            </button>
          )}
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => (last ? onClose() : setStep((s) => s + 1))}
          >
            {last ? 'Заступить на смену' : 'Дальше'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Три простых знака к шагам — рисуются кодом, без картинок. */
function StepGlyph({ kind }: { kind: Step['glyph'] }) {
  return (
    <svg className="intro__glyph" viewBox="0 0 120 64" aria-hidden="true">
      {kind === 'watcher' && (
        <>
          <circle cx="60" cy="32" r="21" className="glyph__ring" />
          <circle cx="60" cy="32" r="8" className="glyph__fill" />
          <path d="M22 44 L38 44 M82 44 L98 44" className="glyph__line" />
        </>
      )}
      {kind === 'loop' && (
        <>
          <path
            d="M38 32 A22 22 0 1 1 60 54"
            className="glyph__ring"
            fill="none"
          />
          <path d="M60 46 L60 62 L52 54Z" className="glyph__fill" />
          {[30, 60, 90].map((x) => (
            <circle key={x} cx={x} cy="12" r="3" className="glyph__fill" />
          ))}
        </>
      )}
      {kind === 'goal' && (
        <>
          <circle cx="60" cy="32" r="21" className="glyph__ring" />
          <path d="M46 32 L56 42 L76 22" className="glyph__line" fill="none" />
        </>
      )}
    </svg>
  )
}
