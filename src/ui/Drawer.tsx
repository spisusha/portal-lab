import type { ReactNode } from 'react'

/**
 * Раскрывающийся блок.
 *
 * Подробности, которые нужны не всем и не сразу, не должны лежать открытыми
 * на экране: так лаборатория превращается в техническую панель. Но и прятать
 * их нельзя — заголовок и подпись видны всегда, блок открывается одним
 * нажатием и работает с клавиатуры, потому что внутри обычный `<details>`,
 * а не собственная выдумка.
 *
 * Жил приватно внутри `Archive.tsx`, пока такой блок был один. С появлением
 * FAQ компонент стал общим: две копии одной разметки рано или поздно
 * разъезжаются.
 */
export function Drawer({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <details className="drawer">
      <summary className="drawer__handle">
        <span className="drawer__mark" aria-hidden="true" />
        <span className="drawer__title">{title}</span>
        {hint && <span className="drawer__hint">{hint}</span>}
      </summary>
      <div className="drawer__body">{children}</div>
    </details>
  )
}
