import { useLab } from '../state/labStore'

/**
 * Подтверждение опасного действия.
 *
 * ТЗ отдельно требует: нельзя закрыть портал с существами внутри
 * «без предупреждения». Поэтому такое закрытие — всегда два шага.
 */
export function ConfirmDialog() {
  const { state, dispatch } = useLab()
  const pending = state.pendingConfirm

  if (!pending) return null

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="dialog">
        <div className="dialog__title">Требуется подтверждение</div>
        <p>{pending.question}</p>
        <div className="dialog__buttons">
          <button
            type="button"
            className="btn btn--danger"
            onClick={() =>
              dispatch({
                type: 'CLOSE',
                portalId: pending.portalId,
                confirmed: true,
              })
            }
          >
            Да, закрыть портал
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
