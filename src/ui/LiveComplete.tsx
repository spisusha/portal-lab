import { useEffect, useRef, useState } from 'react'
import { useLab } from '../state/labStore'
import { copyToClipboard, createSeedCode, shiftUrlFor } from '../state/liveSeed'
import { formatClock } from '../domain/types'
import { LIVE_RANK_SCALE } from '../domain/live/score'

/**
 * Итог живой смены.
 *
 * Отличается от демонстрационного итога тем, ради чего живая смена вообще
 * существует: смену можно переиграть, а значит, нужен результат, который
 * с чем-то сравнивают. Отсюда счёт, ранг и разбор по блокам.
 *
 * Счёт здесь только показывается. Считает его `domain/live/score.ts` — в
 * компоненте нет ни одной формулы, как и во всём остальном интерфейсе.
 *
 * Три кнопки внизу отвечают на три разных вопроса: «ещё раз эту же»,
 * «другую» и «дай ссылку». Результат копирования подтверждается текстом,
 * а не только сменой иконки: `role="status"` объявит его и скринридеру.
 */
export function LiveComplete({
  showLog,
  onShowLog,
  onReset,
}: {
  showLog: boolean
  onShowLog: () => void
  /** Сбросить выбор портала в камере перед стартом новой смены. */
  onReset: () => void
}) {
  const { liveScore, shiftSummary, state, debrief, debriefHeadline, dispatch } = useLab()
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  if (!liveScore || !state.live) return null
  const seed = state.live.seed

  const start = (nextSeed: string) => {
    onReset()
    dispatch({ type: 'LOAD_SCENARIO', scenario: 'live', seed: nextSeed, confirmed: true })
  }

  const share = async () => {
    const ok = await copyToClipboard(shiftUrlFor(seed))
    setCopied(ok ? 'done' : 'failed')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied('idle'), 6000)
  }

  return (
    <section className="complete complete--live" aria-labelledby="live-complete-title">
      <div className={`complete__mark complete__mark--rank-${liveScore.rank}`} aria-hidden="true" />
      <p className="complete__eyebrow">
        Итог живой смены · код <code>{seed}</code>
      </p>
      <h2 id="live-complete-title" className="complete__title">
        Смена завершена
      </h2>

      {/* Ранг продублирован буквой, словом и числом: одного знака мало. */}
      <p className={`verdict verdict--${liveScore.rank}`}>
        <span className="verdict__rank">{liveScore.rank}</span>
        <span className="verdict__body">
          <strong className="verdict__label">{liveScore.label}</strong>
          <span className="verdict__score">
            {liveScore.total} из 100
          </span>
        </span>
      </p>
      <p className="complete__explanation">{liveScore.headline}</p>

      <h3 className="complete__section">Из чего сложился результат</h3>
      <ol className="tally-list">
        {liveScore.parts.map((part) => (
          <li key={part.key} className="tally-list__row">
            <span className="tally-list__head">
              <span className="tally-list__title">{part.title}</span>
              <span className="tally-list__points">
                {part.points} <span className="tally-list__max">из {part.max}</span>
              </span>
            </span>
            <span className="tally-list__bar" aria-hidden="true">
              <span
                className="tally-list__fill"
                style={{ width: `${Math.round((part.points / part.max) * 100)}%` }}
              />
            </span>
            <span className="tally-list__why">{part.explanation}</span>
          </li>
        ))}
      </ol>

      <p className={`directive directive--result directive--${liveScore.directive.met ? 'met' : 'missed'}`}>
        <span className="directive__label">
          Директива {liveScore.directive.met ? 'выполнена' : 'не выполнена'}
        </span>
        <span className="directive__text">
          {liveScore.directive.directive.title}. {liveScore.directive.explanation}
        </span>
      </p>
      {!liveScore.directive.met && (
        <p className="complete__note">
          Директива — дополнительная задача лаборатории, а не главная цель:
          она стоит десять очков из ста. Смена с невыполненной директивой,
          но без потерь остаётся сильной.
        </p>
      )}

      <details className="drawer">
        <summary className="drawer__handle">
          <span className="drawer__mark" aria-hidden="true" />
          <span className="drawer__title">Шкала рангов смены</span>
          <span className="drawer__hint">
            сейчас {liveScore.rank} — {liveScore.label}
          </span>
        </summary>
        <div className="drawer__body">
          <ol className="scale__list">
            {LIVE_RANK_SCALE.map((step) => (
              <li
                key={step.rank}
                // Отдельный набор классов, а не общий со шкалой риска:
                // там S — худшее, здесь — лучшее, и общий цвет соврал бы.
                className={`scale__step scale__step--live-${step.rank}${
                  step.rank === liveScore.rank ? ' scale__step--now' : ''
                }`}
              >
                <span className="scale__rank">{step.rank}</span>
                <span className="scale__label">{step.label}</span>
                <span className="scale__range">
                  {step.min}–{step.max}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </details>

      <h3 className="complete__section">Как прошла смена</h3>
      <dl className="complete__metrics">
        {(
          [
            ['Продолжительность', `${shiftSummary.durationMinutes} мин (${formatClock(shiftSummary.durationMinutes)})`],
            ['Выполнено циклов', `${shiftSummary.cycles} из 6`],
            ['Порталов в начале', shiftSummary.startedPortals],
            ['Осталось открытыми', shiftSummary.remainingOpen],
            ['Закрыто', shiftSummary.closed],
            ['Схлопнулось', shiftSummary.collapsed],
            ['Стабилизировано хотя бы раз', shiftSummary.stabilized],
            ['Наблюдателей вернулось', shiftSummary.observersReturned],
            ['Существ потеряно', shiftSummary.lostCreatures],
            ['Научных данных собрано', liveScore.science],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <h3 className="complete__section">Разбор решений</h3>
      <p className="complete__explanation">{debriefHeadline}</p>
      {debrief.length > 0 && (
        <ol className="debrief">
          {debrief.map((row, index) => (
            <li key={index} className={`debrief__row debrief__row--${row.agreement}`}>
              <span className="debrief__cycle">Цикл {row.cycle}</span>
              <span className="debrief__body">
                <span className="debrief__portal">{row.portalName}</span>
                <span className="debrief__action">
                  {row.actionLabel}
                  <span className="debrief__note"> · {row.agreementNote}</span>
                </span>
                <span className="debrief__advice">
                  Система предлагала: {row.recommendedLabel}. {row.recommendedText}
                </span>
                <span className="debrief__outcome">{row.outcome}</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="complete__actions">
        <button type="button" className="btn btn--primary" onClick={() => start(seed)}>
          Повторить эту смену
        </button>
        <button type="button" className="btn" onClick={() => start(createSeedCode())}>
          Новая живая смена
        </button>
        <button type="button" className="btn" onClick={share}>
          Поделиться сменой
        </button>
        {!showLog && (
          <button type="button" className="btn btn--ghost" onClick={onShowLog}>
            Показать журнал смены
          </button>
        )}
      </div>

      {/* Обратная связь текстом: «кнопка мигнула» — это не подтверждение. */}
      <p className="complete__copied" role="status" aria-live="polite">
        {copied === 'done'
          ? `Ссылка скопирована: ${shiftUrlFor(seed)}`
          : copied === 'failed'
            ? `Скопировать не удалось. Код смены — ${seed}, его можно передать вручную.`
            : ''}
      </p>
    </section>
  )
}
