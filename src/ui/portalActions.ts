import type { LabAction, PortalActionKind } from '../domain/types'

/**
 * Порядок кнопок в карточке: от мягкого вмешательства к необратимому.
 * Закрытие всегда последнее — его нельзя отменить.
 */
export const ACTION_ORDER: PortalActionKind[] = [
  'STABILIZE',
  'SEND_OBSERVER',
  'MARK_QUESTIONED',
  'CLOSE',
]

/**
 * Действие интерфейса → действие домена.
 *
 * Общий перевод для карточки и для блока «требует решения»: одна и та же
 * кнопка в двух местах экрана обязана отправлять одно и то же событие.
 */
export function toLabAction(
  kind: PortalActionKind,
  portalId: string,
): LabAction {
  switch (kind) {
    case 'STABILIZE':
      return { type: 'STABILIZE', portalId }
    case 'SEND_OBSERVER':
      return { type: 'SEND_OBSERVER', portalId }
    case 'MARK_QUESTIONED':
      return { type: 'MARK_QUESTIONED', portalId }
    case 'CLOSE':
      return { type: 'CLOSE', portalId }
  }
}
