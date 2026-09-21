import { useEffect, useState } from 'react'
import { useLab } from '../state/labStore'

/** Сколько держится сводка изменений, мс. */
const HOLD = 6000

/**
 * Что изменилось после нажатия — на том же экране, где нажимали.
 *
 * До этого единственным свидетельством результата был журнал в самом низу:
 * человек нажимал «Стабилизировать», и ему приходилось догадаться
 * прокрутить страницу, чтобы убедиться, что вообще что-то произошло.
 *
 * Полоса живёт несколько секунд и не перехватывает фокус: это
 * подтверждение, а не диалог. Для скринридера — `role="status"`,
 * то есть объявляется, но не прерывает.
 */
export function ChangeFlash() {
  const { change } = useLab()
  const [shown, setShown] = useState<typeof change>(null)

  const step = change?.step ?? null
  const hasContent = Boolean(change && change.portals.length > 0)

  useEffect(() => {
    if (!hasContent) return
    setShown(change)
    const timer = window.setTimeout(() => setShown(null), HOLD)
    return () => window.clearTimeout(timer)
    // Перезапускаем показ на каждом новом шаге, даже если текст совпал.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, hasContent])

  if (!shown || shown.portals.length === 0) return null

  return (
    <div className="flash" role="status" aria-live="polite">
      <div className="flash__inner" key={shown.step}>
        {shown.portals.map((portal) => (
          <p className="flash__row" key={portal.portalId}>
            <span className="flash__portal">{portal.portalName}</span>
            {portal.changes.map((field) => (
              <span
                key={field.label}
                className={`flash__field flash__field--${field.direction}`}
              >
                {field.label} {field.from}
                <span className="flash__arrow" aria-hidden="true"> → </span>
                <span className="sr-only"> изменилось на </span>
                <strong>{field.to}</strong>
              </span>
            ))}
          </p>
        ))}
      </div>
    </div>
  )
}
