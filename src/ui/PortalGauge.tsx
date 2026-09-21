import { useId } from 'react'
import type { RiskBreakdown } from '../domain/risk'
import { RANK_SCALE } from '../domain/risk'

/**
 * Главный объект экрана: сам портал.
 *
 * Опасность закодирована тремя независимыми способами, и ни один из них
 * не цвет:
 *  — буква ранга в центре;
 *  — число риска под ней;
 *  — шесть насечек по кругу, залито ровно столько, каков ранг, плюс
 *    тонкая дуга, длина которой равна риску в процентах.
 * На чёрно-белом экране и при любом виде дальтонизма портал читается.
 *
 * Скорость вращения обечаек и яркость ядра зависят от риска. Всё движение
 * гасится через prefers-reduced-motion в таблице стилей.
 */

const CENTER = 100
const NOTCH_RADIUS = 88
const ARC_RADIUS = 76
const ARC_LENGTH = 2 * Math.PI * ARC_RADIUS
const NOTCH_COUNT = RANK_SCALE.length

function polar(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  }
}

/** Дуга одной насечки шкалы рангов. */
function notchPath(index: number): string {
  const step = 360 / NOTCH_COUNT
  const start = index * step + 5
  const end = (index + 1) * step - 5
  const a = polar(start, NOTCH_RADIUS)
  const b = polar(end, NOTCH_RADIUS)
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${NOTCH_RADIUS} ${NOTCH_RADIUS} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
}

export function PortalGauge({
  risk,
  size = 'hero',
}: {
  risk: RiskBreakdown
  size?: 'hero' | 'compact'
}) {
  const uid = useId().replace(/:/g, '')
  const coreId = `core-${uid}`
  const rimId = `rim-${uid}`

  const rankIndex = RANK_SCALE.findIndex((step) => step.rank === risk.rank)
  const filled = risk.applicable ? rankIndex + 1 : 0
  const intensity = risk.applicable ? risk.score / 100 : 0
  const arc = risk.applicable ? (ARC_LENGTH * risk.score) / 100 : 0

  const description = risk.applicable
    ? `Портал ранга ${risk.rank} — ${risk.label}. Риск ${risk.score} из 100.`
    : 'Портал неактивен, риск к нему не считается.'

  return (
    <div
      className={[
        'gauge',
        `gauge--${size}`,
        `gauge--rank-${risk.rank}`,
        risk.applicable ? '' : 'gauge--dim',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ ['--intensity' as string]: intensity.toFixed(2) }}
    >
      <svg viewBox="0 0 200 200" role="img" aria-label={description}>
        <defs>
          <radialGradient id={coreId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.92" />
            <stop offset="58%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.5" />
          </radialGradient>
          <radialGradient id={rimId} cx="50%" cy="50%" r="50%">
            <stop offset="72%" stopColor="currentColor" stopOpacity="0" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.28" />
          </radialGradient>
        </defs>

        {/* Свет, который проём выбрасывает в комнату. */}
        <circle className="gauge__halo" cx={CENTER} cy={CENTER} r="96" fill={`url(#${rimId})`} />

        {/* Ядро — то, что видно в самом проёме. */}
        <circle className="gauge__core" cx={CENTER} cy={CENTER} r="58" fill={`url(#${coreId})`} />

        {/* Две встречные обечайки: движение читается боковым зрением. */}
        <circle
          className="gauge__shell gauge__shell--cw"
          cx={CENTER}
          cy={CENTER}
          r="64"
          strokeDasharray="18 13"
        />
        <circle
          className="gauge__shell gauge__shell--ccw"
          cx={CENTER}
          cy={CENTER}
          r="50"
          strokeDasharray="6 15"
        />

        {/* Точное показание: длина дуги равна риску в процентах. */}
        <circle
          className="gauge__track"
          cx={CENTER}
          cy={CENTER}
          r={ARC_RADIUS}
        />
        <circle
          className="gauge__arc"
          cx={CENTER}
          cy={CENTER}
          r={ARC_RADIUS}
          strokeDasharray={`${arc.toFixed(2)} ${ARC_LENGTH.toFixed(2)}`}
        />

        {/* Шкала рангов формой: залито столько насечек, каков ранг. */}
        {RANK_SCALE.map((step, index) => (
          <path
            key={step.rank}
            className={`gauge__notch${index < filled ? ' gauge__notch--on' : ''}`}
            d={notchPath(index)}
          />
        ))}
      </svg>

      <div className="gauge__read" aria-hidden="true">
        <span className="gauge__rank">{risk.applicable ? risk.rank : '—'}</span>
        <span className="gauge__score">
          {risk.applicable ? `риск ${risk.score}` : 'риск снят'}
        </span>
      </div>
    </div>
  )
}
