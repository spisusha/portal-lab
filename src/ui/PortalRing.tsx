import { useId } from 'react'
import type { RiskBreakdown } from '../domain/risk'
import { RANK_SCALE } from '../domain/risk'

/**
 * Живой портал: вращающееся кольцо, которое меняет состояние вместе с риском.
 *
 * Важное требование доступности — опасность не должна передаваться одним
 * только цветом. Поэтому вокруг кольца шесть сегментов шкалы E…S, и залито
 * ровно столько, каков ранг: уровень читается по форме даже на чёрно-белом
 * экране и при любом виде дальтонизма. Цвет лишь дублирует эту информацию.
 *
 * Скорость вращения и яркость ядра зависят от риска, но всё движение
 * выключается через prefers-reduced-motion в таблице стилей.
 */

const CENTER = 60
const SEGMENT_RADIUS = 52
const SEGMENT_COUNT = RANK_SCALE.length

function polar(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  }
}

/** Дуга одного сегмента шкалы. */
function segmentPath(index: number): string {
  const step = 360 / SEGMENT_COUNT
  const start = index * step + 4
  const end = (index + 1) * step - 4
  const a = polar(start, SEGMENT_RADIUS)
  const b = polar(end, SEGMENT_RADIUS)
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${SEGMENT_RADIUS} ${SEGMENT_RADIUS} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
}

export function PortalRing({
  risk,
  label,
}: {
  risk: RiskBreakdown
  label?: string
}) {
  const uid = useId().replace(/:/g, '')
  const coreId = `core-${uid}`

  const rankIndex = RANK_SCALE.findIndex((step) => step.rank === risk.rank)
  // Для неактивного портала шкала гаснет целиком.
  const filled = risk.applicable ? rankIndex + 1 : 0
  const intensity = risk.applicable ? risk.score / 100 : 0

  const description = risk.applicable
    ? `Портал ранга ${risk.rank}, риск ${risk.score} из 100`
    : 'Портал неактивен, риск не считается'

  return (
    <figure className="portal-ring">
      <svg
        viewBox="0 0 120 120"
        className={`ring ring--${risk.rank}${risk.applicable ? '' : ' ring--dim'}`}
        style={{ ['--intensity' as string]: intensity.toFixed(2) }}
        role="img"
        aria-label={description}
      >
        <defs>
          <radialGradient id={coreId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.75" />
            <stop offset="55%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ядро — свет самого проёма. */}
        <circle className="ring__core" cx={CENTER} cy={CENTER} r="34" fill={`url(#${coreId})`} />

        {/* Две встречные обечайки: движение читается даже боковым зрением. */}
        <circle
          className="ring__spin ring__spin--cw"
          cx={CENTER}
          cy={CENTER}
          r="40"
          strokeDasharray="14 10"
        />
        <circle
          className="ring__spin ring__spin--ccw"
          cx={CENTER}
          cy={CENTER}
          r="30"
          strokeDasharray="5 12"
        />

        {/* Шкала опасности формой: залито столько сегментов, каков ранг. */}
        {RANK_SCALE.map((step, index) => (
          <path
            key={step.rank}
            className={`ring__segment${index < filled ? ' ring__segment--on' : ''}`}
            d={segmentPath(index)}
          />
        ))}
      </svg>
      {label && <figcaption className="portal-ring__label">{label}</figcaption>}
    </figure>
  )
}
