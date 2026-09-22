import { useEffect, useRef } from 'react'
import { useLab } from '../state/labStore'

/**
 * Подтверждение опасного действия.
 *
 * ТЗ отдельно требует: нельзя закрыть портал с существами внутри
 * «без предупреждения». Поэтому такое закрытие — всегда два шага.
 *
 * Диалог забирает фокус и закрывается по Esc: модальное окно, из которого
 * нельзя выйти с клавиатуры, — ловушка.
 */
export function ConfirmDialog() {
  const { state, dispatch } = useLab()
  const pending = state.pendingConfirm
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pending) return
    dialogRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dispatch({ type: 'CANCEL_CONFIRM' })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pending, dispatch])

  if (!pending) return null

  const confirm = () => {
    if (pending.action === 'CLOSE' && pending.portalId) {
      dispatch({ type: 'CLOSE', portalId: pending.portalId, confirmed: true })
    } else if (pending.action === 'NEXT_CYCLE') {
      dispatch({ type: 'NEXT_CYCLE', confirmed: true })
    } else if (pending.action === 'LOAD_SCENARIO' && pending.scenario) {
      // Код смены обязан пережить подтверждение: иначе «да» на вопрос о
      // сбросе открыло бы не ту живую смену, которую выбрали.
      dispatch({
        type: 'LOAD_SCENARIO',
        scenario: pending.scenario,
        seed: pending.seed,
        confirmed: true,
      })
    }
  }

  const title =
    pending.action === 'NEXT_CYCLE'
      ? 'Нужное подтверждение'
      : pending.action === 'LOAD_SCENARIO'
        ? 'Сбросить прогресс?'
        : 'Требуется подтверждение'

  return (
    <div className="overlay" role="presentation">
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <h2 className="dialog__title" id="confirm-title">{title}</h2>
        <p>{pending.question}</p>
        <div className="dialog__buttons">
          <button
            type="button"
            className="btn btn--danger"
            onClick={confirm}
          >
            {pending.action === 'CLOSE'
              ? 'Да, закрыть портал'
              : pending.action === 'NEXT_CYCLE'
                ? 'Да, перейти к циклу'
                : 'Да, сбросить и загрузить'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => dispatch({ type: 'CANCEL_CONFIRM' })}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
