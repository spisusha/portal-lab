/**
 * Правила: какие действия над порталом допустимы и почему запрещены остальные.
 *
 * Главный принцип интерфейса: пользователь не должен натыкаться на ошибку
 * после нажатия. Поэтому каждая проверка возвращает не только «можно/нельзя»,
 * но и причину — её показывают рядом с неактивной кнопкой ДО нажатия.
 *
 * Все запреты живут здесь, в одном месте. Компоненты их не дублируют.
 */

import type { ActionCheck, Portal, PortalActionKind } from './types'
import { STATUS_LABELS, isActive } from './types'
import { computeRisk, isCriticalRank } from './risk'

/** Предел контура стабилизации: выше 95 стабильность поднять нельзя. */
export const MAX_STABILITY = 95

/** Насколько стабилизация поднимает стабильность. */
export const STABILIZE_STEP = 25

/** Побочный эффект стабилизации: гашение энергии. */
export const STABILIZE_ENERGY_DROP = 10

export function checkAction(
  portal: Portal,
  kind: PortalActionKind,
): ActionCheck {
  // Терминальные статусы запрещают вообще всё.
  if (!isActive(portal)) {
    const status = STATUS_LABELS[portal.status].toLowerCase()
    return {
      allowed: false,
      reason: `Портал ${status}. Действия над ним больше невозможны.`,
    }
  }

  switch (kind) {
    case 'STABILIZE': {
      if (portal.stability >= MAX_STABILITY) {
        return {
          allowed: false,
          reason: `Стабильность уже ${portal.stability} из 100 — это предел контура стабилизации.`,
        }
      }
      return { allowed: true }
    }

    case 'SEND_OBSERVER': {
      if (portal.observerInside) {
        return {
          allowed: false,
          reason: 'Наблюдатель уже внутри. Дождитесь его отчёта.',
        }
      }
      const risk = computeRisk(portal)
      if (isCriticalRank(risk.rank)) {
        return {
          allowed: false,
          reason: `Ранг ${risk.rank} (${risk.label}) — отправка наблюдателя запрещена регламентом. Сначала снизьте риск стабилизацией.`,
        }
      }
      return { allowed: true }
    }

    case 'CLOSE': {
      if (portal.creaturesInside > 0) {
        const count = portal.creaturesConfirmed
          ? `${portal.creaturesInside}`
          : `около ${portal.creaturesInside}`
        return {
          allowed: true,
          requiresConfirm: true,
          confirmQuestion: `Внутри портала ${count} существ. Закрытие отрежет их от пути домой. Подтвердить закрытие?`,
        }
      }
      if (portal.observerInside) {
        return {
          allowed: true,
          requiresConfirm: true,
          confirmQuestion:
            'Внутри портала находится наблюдатель. Подтвердить закрытие?',
        }
      }
      return { allowed: true }
    }

    case 'MARK_QUESTIONED': {
      if (portal.status === 'QUESTIONED') {
        return {
          allowed: false,
          reason: 'Портал уже помечен как «под вопросом».',
        }
      }
      return { allowed: true }
    }
  }
}

/** Удобная обёртка: проверить сразу все действия для портала. */
export function checkAllActions(
  portal: Portal,
): Record<PortalActionKind, ActionCheck> {
  return {
    STABILIZE: checkAction(portal, 'STABILIZE'),
    SEND_OBSERVER: checkAction(portal, 'SEND_OBSERVER'),
    CLOSE: checkAction(portal, 'CLOSE'),
    MARK_QUESTIONED: checkAction(portal, 'MARK_QUESTIONED'),
  }
}
