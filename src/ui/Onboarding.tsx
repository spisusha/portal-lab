import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
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
  /** Что подсветить на настоящем экране. Пусто — шаг без указателя. */
  target?: string
}

/**
 * Три шага вместо трёх экранов текста: роль и цель, потом указатель
 * на реальную часть интерфейса, потом первое действие.
 *
 * Прежнее вступление объясняло словами то, что можно показать пальцем,
 * и после его закрытия человек всё равно не знал, куда смотреть.
 */
const STEPS: Step[] = [
  {
    title: 'Вы — смотритель ночной смены',
    text:
      'В лаборатории открыты порталы в другие миры. Каждый теряет стабильность ' +
      'и однажды схлопывается. Схлопывание — провал смены, особенно если внутри ' +
      'остались существа. Не допустить его — ваша работа.',
  },
  {
    title: 'Опасный портал уже выбран',
    text:
      'Камера показывает самый опасный портал смены и объясняет, почему именно ' +
      'его. Ранг E–S, риск от 0 до 100 и главная угроза видны сразу — искать ' +
      'по списку не нужно.',
    target: '[data-tour="camera"]',
  },
  {
    title: 'Первое действие — эта кнопка',
    text:
      'Под камерой стоит одно рекомендованное действие: приложение объясняет, ' +
      `что оно изменит. Когда решение принято — двигайте время кнопкой ` +
      `«Следующий цикл» (+${CYCLE_MINUTES} мин). Прогноз рядом с ней ` +
      'заранее говорит, что случится.',
    target: '[data-tour="primary"]',
  },
]

interface Spot {
  top: number
  left: number
  width: number
  height: number
}

export function Onboarding({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const [spot, setSpot] = useState<Spot | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const current = STEPS[step]
  const last = step === STEPS.length - 1

  // Фокус уводим в подсказку, чтобы Esc закрывал её откуда угодно,
  // а клавиатурная навигация не осталась на фоне.
  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Подсветка меряется по живому элементу: если разметка изменится,
  // указатель не окажется в пустом месте, а просто исчезнет.
  useLayoutEffect(() => {
    if (!current.target) {
      setSpot(null)
      return
    }

    const measure = () => {
      const node = document.querySelector(current.target as string)
      if (!node) {
        setSpot(null)
        return
      }
      const rect = node.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) {
        setSpot(null)
        return
      }
      setSpot({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      })
    }

    const node = document.querySelector(current.target)
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    measure()
    const again = window.setTimeout(measure, 320)

    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.clearTimeout(again)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [current.target, step])

  const card = (
    <div
      className={`tour__card${spot ? ' tour__card--anchored' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-title"
      tabIndex={-1}
      ref={dialogRef}
      style={spot ? cardPosition(spot) : undefined}
    >
      <p className="tour__counter">
        Шаг {step + 1} из {STEPS.length}
      </p>
      <h2 className="tour__title" id="intro-title">
        {current.title}
      </h2>
      <p className="tour__text">{current.text}</p>

      <div className="tour__dots" aria-hidden="true">
        {STEPS.map((item, index) => (
          <span
            key={item.title}
            className={`tour__dot${index === step ? ' tour__dot--on' : ''}`}
          />
        ))}
      </div>

      <div className="tour__buttons">
        <button type="button" className="btn btn--ghost" onClick={onClose}>
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
  )

  if (!spot) {
    return (
      <div className="tour tour--centred" role="presentation">
        <FirstGlyph />
        {card}
      </div>
    )
  }

  return (
    <div className="tour tour--spotlit" role="presentation">
      {/* Затемнение сделано огромной тенью вокруг выреза: так подсвеченный
          кусок интерфейса остаётся настоящим, а не картинкой. */}
      <div
        className="tour__hole"
        aria-hidden="true"
        style={{
          top: spot.top - 8,
          left: spot.left - 8,
          width: spot.width + 16,
          height: spot.height + 16,
        }}
      />
      {card}
    </div>
  )
}

/** Карточка встаёт под подсветкой, а если места нет — над ней. */
function cardPosition(spot: Spot): React.CSSProperties {
  const CARD = 360
  const GAP = 18
  const viewportH = typeof window === 'undefined' ? 800 : window.innerHeight
  const viewportW = typeof window === 'undefined' ? 1200 : window.innerWidth

  const below = spot.top + spot.height + GAP
  const fitsBelow = below + 230 < viewportH
  const top = fitsBelow ? below : Math.max(GAP, spot.top - 230 - GAP)

  const wanted = spot.left + spot.width / 2 - CARD / 2
  const left = Math.min(Math.max(GAP, wanted), Math.max(GAP, viewportW - CARD - GAP))

  return { top, left, width: Math.min(CARD, viewportW - GAP * 2) }
}

/** Знак к первому шагу: проём под наблюдением. Рисуется кодом. */
function FirstGlyph() {
  return (
    <svg className="tour__glyph" viewBox="0 0 160 96" aria-hidden="true">
      <circle className="tour__glyph-ring" cx="80" cy="48" r="30" />
      <circle className="tour__glyph-ring" cx="80" cy="48" r="20" />
      <circle className="tour__glyph-core" cx="80" cy="48" r="8" />
      <path className="tour__glyph-line" d="M14 70 L40 70 M120 70 L146 70" />
      <path className="tour__glyph-line" d="M27 70 L27 56 M133 70 L133 56" />
    </svg>
  )
}
