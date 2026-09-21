import type { RiskBreakdown } from '../domain/risk'

/**
 * Значок ранга опасности.
 *
 * Буква — самостоятельный носитель смысла: ранг читается, даже если цвет
 * не различается. Полное значение продублировано в title и в aria-label,
 * чтобы шкала E–S не требовала легенды под рукой.
 */
export function RankBadge({ risk }: { risk: RiskBreakdown }) {
  if (!risk.applicable) {
    return (
      <span
        className="rank rank--muted"
        title="Риск снят: портал неактивен"
        aria-label="Риск снят, портал неактивен"
      >
        —
      </span>
    )
  }

  const full = `Ранг ${risk.rank} — ${risk.label}, риск ${risk.score} из 100`

  return (
    <span className={`rank rank--${risk.rank}`} title={full} aria-label={full}>
      {risk.rank}
    </span>
  )
}
