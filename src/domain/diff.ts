/**
 * Что изменилось после действия.
 *
 * До этого единственным способом узнать результат был журнал внизу
 * экрана: человек нажимал кнопку, на экране что-то менялось, и надо было
 * догадаться прокрутить вниз. Здесь состояние сравнивается «до/после»,
 * и интерфейс может показать изменение рядом с местом нажатия:
 * «риск 72 → 60», «стабильность 30 → 55».
 *
 * Чистое сравнение двух состояний — никакой мутации и никакого React.
 */

import type { LabState, Portal } from './types'
import { STATUS_LABELS } from './types'
import { computeRisk } from './risk'

export interface FieldChange {
  label: string
  from: string
  to: string
  /** Стало лучше, хуже или просто иначе — задаёт цвет и знак в интерфейсе. */
  direction: 'better' | 'worse' | 'neutral'
}

export interface PortalChange {
  portalId: string
  portalName: string
  changes: FieldChange[]
}

/** Сколько порталов показывать в одной порции обратной связи. */
export const CHANGE_LIMIT = 3

export function diffStates(
  before: LabState,
  after: LabState,
): PortalChange[] {
  const previous = new Map(before.portals.map((p) => [p.id, p]))

  const result: PortalChange[] = []
  for (const portal of after.portals) {
    const was = previous.get(portal.id)
    if (!was) continue
    const changes = diffPortal(was, portal)
    if (changes.length > 0) {
      result.push({
        portalId: portal.id,
        portalName: portal.name,
        changes,
      })
    }
  }
  // Если за цикл изменилось много порталов, первыми показываем необратимые
  // события и возвращение наблюдателя. Иначе обычный дрейф первых трёх
  // элементов мог вытеснить из видимой обратной связи схлопывание портала.
  return result.sort((a, b) => changePriority(b) - changePriority(a)).slice(0, CHANGE_LIMIT)
}

function changePriority(portal: PortalChange): number {
  if (
    portal.changes.some(
      (change) => change.label === 'Статус' && change.to === STATUS_LABELS.COLLAPSED,
    )
  ) {
    return 100
  }
  if (portal.changes.some((change) => change.label === 'Наблюдатель')) return 80
  if (portal.changes.some((change) => change.label === 'Статус')) return 60
  if (portal.changes.some((change) => change.direction === 'worse')) return 40
  if (portal.changes.some((change) => change.direction === 'better')) return 30
  return 10
}

function diffPortal(was: Portal, now: Portal): FieldChange[] {
  const changes: FieldChange[] = []

  if (was.status !== now.status) {
    changes.push({
      label: 'Статус',
      from: STATUS_LABELS[was.status],
      to: STATUS_LABELS[now.status],
      direction: now.status === 'COLLAPSED' ? 'worse' : 'neutral',
    })
  }

  const riskWas = computeRisk(was)
  const riskNow = computeRisk(now)
  if (riskWas.applicable && riskNow.applicable && riskWas.score !== riskNow.score) {
    changes.push({
      label: 'Риск',
      from: String(riskWas.score),
      to: String(riskNow.score),
      direction: riskNow.score < riskWas.score ? 'better' : 'worse',
    })
  }

  if (was.stability !== now.stability) {
    changes.push({
      label: 'Стабильность',
      from: String(was.stability),
      to: String(now.stability),
      direction: now.stability > was.stability ? 'better' : 'worse',
    })
  }

  if (was.energy !== now.energy) {
    changes.push({
      label: 'Энергия',
      from: String(was.energy),
      to: String(now.energy),
      direction: now.energy < was.energy ? 'better' : 'worse',
    })
  }

  if (was.creaturesInside !== now.creaturesInside) {
    changes.push({
      label: 'Существ внутри',
      from: `${was.creaturesConfirmed ? '' : '≈'}${was.creaturesInside}`,
      to: `${now.creaturesConfirmed ? '' : '≈'}${now.creaturesInside}`,
      direction: 'neutral',
    })
  }

  if (was.observerInside !== now.observerInside) {
    changes.push({
      label: 'Наблюдатель',
      from: was.observerInside ? 'внутри' : 'на посту',
      to: now.observerInside ? 'внутри' : 'на посту',
      direction: 'neutral',
    })
  }

  return changes
}
