import { useLab } from '../state/labStore'

/**
 * Состояние лаборатории одной строкой.
 *
 * Раньше это была сетка из пяти крупных счётчиков — самый заметный блок
 * экрана после портала, хотя ни одно из этих чисел не требует решения.
 * Теперь счётчики сведены к плотной строке: они нужны как фон, а не как
 * заголовок. Нули приглушены, ненулевые потери — нет.
 */
export function LabStatus() {
  const { summary } = useLab()

  const cells = [
    { label: 'открыто', value: summary.open, alarm: false },
    { label: 'критических', value: summary.critical, alarm: summary.critical > 0 },
    { label: 'под вопросом', value: summary.questioned, alarm: false },
    { label: 'закрыто', value: summary.closed, alarm: false },
    { label: 'схлопнулось', value: summary.collapsed, alarm: summary.collapsed > 0 },
    { label: 'существ внутри', value: summary.creaturesInside, alarm: false },
  ]

  return (
    <section className="status" aria-label="Состояние лаборатории">
      {cells.map((cell) => (
        <p
          key={cell.label}
          className={[
            'status__cell',
            cell.value === 0 ? 'status__cell--zero' : '',
            cell.alarm ? 'status__cell--alarm' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <span className="status__value">{cell.value}</span>
          <span className="status__label">{cell.label}</span>
        </p>
      ))}
    </section>
  )
}
