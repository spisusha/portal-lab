/**
 * Разбор решений живой смены.
 *
 * Что это такое и чем не является. Это хроника: в каком цикле, по какому
 * порталу, что выбрал человек, что в тот момент предлагала система и что
 * из этого вышло. Ничего больше.
 *
 * Чего здесь сознательно нет:
 *  — слова «идеальное» и «единственно правильное» рядом с рекомендацией.
 *    `recommend.ts` — это эвристика из пяти правил, а не доказанный оптимум,
 *    и выдавать её за эталон было бы прямым обманом;
 *  — контрфактического «а вот если бы вы нажали другое, было бы лучше».
 *    Чтобы такое утверждать, нужно досчитать альтернативную смену до конца,
 *    а этого здесь не делается;
 *  — оценок и упрёков. Разбор помогает понять прохождение, а не судить его.
 *
 * Поэтому совпадение с рекомендацией называется именно совпадением, а
 * расхождение — расхождением.
 */

import type { LabState, Portal, PortalActionKind } from '../types'
import { ACTION_LABELS, currentCycle } from '../types'
import { computeRisk } from '../risk'
import { recommendAction } from '../recommend'
import type { DecisionRecord } from './types'

/**
 * Запись о решении, собранная ДО его применения.
 *
 * Момент важен: рекомендация и риск должны быть теми, которые человек
 * видел на экране, когда нажимал кнопку, а не пересчитанными задним числом
 * по изменившемуся порталу.
 */
export function recordDecision(
  state: LabState,
  portal: Portal,
  action: PortalActionKind,
  outcome: string,
): DecisionRecord {
  const recommendation = recommendAction(portal)
  return {
    cycle: currentCycle(state) + 1,
    atMinutes: state.clockMinutes,
    portalId: portal.id,
    portalName: portal.name,
    action,
    recommended: recommendation.action,
    recommendedText: recommendation.text,
    outcome,
  }
}

/** Короткая строка результата для решений, которые не меняют показатели. */
export function plainOutcome(portal: Portal, action: PortalActionKind): string {
  const risk = computeRisk(portal)
  switch (action) {
    case 'SEND_OBSERVER':
      return `Наблюдатель ушёл внутрь; риск на момент решения — ${risk.score}.`
    case 'MARK_QUESTIONED':
      return `Портал помечен «под вопросом»; показатели не изменились, риск ${risk.score}.`
    case 'CLOSE':
      return portal.creaturesInside > 0
        ? `Портал закрыт; внутри осталось существ: ${portal.creaturesInside}.`
        : 'Портал закрыт без потерь.'
    case 'STABILIZE':
      return `Стабилизация выполнена; риск на момент решения — ${risk.score}.`
  }
}

/** Совпало ли решение с подсказкой системы. Именно совпало, а не «верно». */
export type DecisionAgreement = 'same' | 'different' | 'no-advice'

export function agreementOf(record: DecisionRecord): DecisionAgreement {
  if (record.recommended === null) return 'no-advice'
  return record.recommended === record.action ? 'same' : 'different'
}

export interface DebriefRow extends DecisionRecord {
  actionLabel: string
  recommendedLabel: string
  agreement: DecisionAgreement
  /** Нейтральная подпись к совпадению — без похвалы и без упрёка. */
  agreementNote: string
}

const AGREEMENT_NOTES: Record<DecisionAgreement, string> = {
  same: 'совпало с рекомендацией',
  different: 'расходится с рекомендацией',
  'no-advice': 'система ничего не предлагала',
}

/** Таблица разбора: по строке на решение, в порядке принятия. */
export function buildDebrief(state: LabState): DebriefRow[] {
  const timeline = state.live?.timeline ?? []
  return timeline.map((record) => ({
    ...record,
    actionLabel: ACTION_LABELS[record.action],
    recommendedLabel:
      record.recommended === null
        ? 'наблюдение, действие не требовалось'
        : ACTION_LABELS[record.recommended],
    agreement: agreementOf(record),
    agreementNote: AGREEMENT_NOTES[agreementOf(record)],
  }))
}

/**
 * Одна фраза над таблицей: сколько решений принято и как часто они совпали
 * с подсказкой. Это статистика, а не отметка за смену.
 */
export function debriefHeadline(rows: DebriefRow[]): string {
  if (rows.length === 0) {
    return 'За смену не было принято ни одного решения по порталам.'
  }
  const same = rows.filter((row) => row.agreement === 'same').length
  const advised = rows.filter((row) => row.agreement !== 'no-advice').length
  if (advised === 0) {
    return `Решений принято: ${rows.length}. Система в эти моменты ничего не предлагала.`
  }
  return `Решений принято: ${rows.length}. Из ${advised}, где у системы была подсказка, совпало ${same}. Рекомендация — это подсказка, а не проверенный оптимум: расхождение не означает ошибки.`
}
