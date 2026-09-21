import type { RiskBreakdown } from '../domain/risk'

/**
 * Значок ранга опасности. Ранг продублирован в title и в подписи рядом:
 * шкала E–S должна читаться без легенды.
 */
export function RankBadge({ risk }: { risk: RiskBreakdown }) {
  if (!risk.applicable) {
    return (
      <div className="rank rank--muted" title="Риск снят: портал неактивен">
        —
      </div>
    )
  }
  return (
    <div
      className={`rank rank--${risk.rank}`}
      title={`Ранг ${risk.rank} — ${risk.label}, риск ${risk.score} из 100`}
    >
      {risk.rank}
    </div>
  )
}
