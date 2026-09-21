import { useId } from 'react'
import { worldArt } from './worldArt'

/**
 * Сцена мира назначения — то, что видно по ту сторону портала.
 *
 * Рисуется целиком путями SVG из `worldArt`. Градиенты получают уникальные
 * идентификаторы через useId: на одном экране таких сцен несколько, и при
 * совпадении id браузер применил бы к ним чужую заливку.
 *
 * preserveAspectRatio прижат к низу (`xMidYMax`). Полоса сцены сильно шире
 * своих пропорций, и при обычном центрировании `slice` срезает именно землю
 * с силуэтами, оставляя пустое небо — так первая версия и выглядела.
 */
export function WorldScene({ world }: { world: string }) {
  const art = worldArt(world)
  const uid = useId().replace(/:/g, '')
  const skyId = `sky-${uid}`
  const glowId = `glow-${uid}`

  return (
    <svg
      className="scene"
      viewBox="0 0 160 100"
      preserveAspectRatio="xMidYMax slice"
      role="img"
      aria-label={`Вид мира «${world}»`}
    >
      <defs>
        <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={art.sky[0]} />
          <stop offset="100%" stopColor={art.sky[1]} />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="82%" r="55%">
          <stop offset="0%" stopColor={art.glow} stopOpacity="0.55" />
          <stop offset="100%" stopColor={art.glow} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="160" height="100" fill={`url(#${skyId})`} />
      <rect width="160" height="100" fill={`url(#${glowId})`} />

      <path d={art.far} fill={art.sky[0]} opacity="0.85" />
      <path d={art.near} fill="#05070a" opacity="0.92" />

      {art.marks?.map((mark, index) => (
        <circle
          key={index}
          className={`scene__mark scene__mark--${art.drift}`}
          cx={mark.x}
          cy={mark.y}
          r={mark.r}
          fill={art.glow}
          style={{ animationDelay: `${index * 0.9}s` }}
        />
      ))}
    </svg>
  )
}

/**
 * Мелкий знак мира для строки списка: тот же ближний силуэт, но без неба
 * и частиц. Задача — чтобы мир различался боковым зрением.
 */
export function WorldCrest({ world }: { world: string }) {
  const art = worldArt(world)
  return (
    <svg className="crest" viewBox="40 40 80 50" aria-hidden="true">
      <rect x="40" y="40" width="80" height="50" fill={art.sky[1]} />
      <path d={art.far} fill={art.sky[0]} opacity="0.8" />
      <path d={art.near} fill={art.glow} opacity="0.9" />
    </svg>
  )
}
