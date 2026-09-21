import { RANK_SCALE } from '../domain/risk'

/**
 * Легенда шкалы рангов.
 *
 * До редизайна ранги E…S показывались без единого объяснения: человек видел
 * букву и не знал, хорошо это или плохо. Границы берутся из домена, поэтому
 * легенда не может разойтись с формулой.
 */
export function RankLegend() {
  return (
    <div className="legend">
      <span className="legend__caption">Шкала опасности:</span>
      <ul className="legend__list">
        {RANK_SCALE.map((step) => (
          <li key={step.rank} className={`legend__item legend__item--${step.rank}`}>
            <span className="legend__rank">{step.rank}</span>
            <span className="legend__label">{step.label}</span>
            <span className="legend__range">
              {step.min}–{step.max}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
