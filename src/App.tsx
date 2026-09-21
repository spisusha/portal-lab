import { useCallback, useRef, useState } from 'react'
import { useLab } from './state/labStore'
import { SummaryPanel } from './ui/SummaryPanel'
import { PortalList } from './ui/PortalList'
import { PortalCard } from './ui/PortalCard'
import { EventLog } from './ui/EventLog'
import { ShiftHeader } from './ui/ShiftHeader'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { FocusPanel } from './ui/FocusPanel'
import { Onboarding, useOnboarding } from './ui/Onboarding'
import { WorklogScreen } from './ui/WorklogScreen'

type Tab = 'lab' | 'worklog'

/**
 * Экран собран по приоритету, а не по удобству вёрстки:
 *
 *  1. кто вы, цель смены и текущее время;
 *  2. что требует решения прямо сейчас;
 *  3. краткая сводка;
 *  4. список порталов;
 *  5. карточка выбранного;
 *  6. журнал событий.
 *
 * До редизайна порядок был другим: первым шёл переключатель демо-данных,
 * а рекомендация лежала под разбором формулы — то есть человеку сначала
 * показывали арифметику и только потом то, что нужно сделать.
 */
export function App() {
  const { portals, summary } = useLab()
  const [tab, setTab] = useState<Tab>('lab')
  const [manualId, setManualId] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const intro = useOnboarding()

  // Если выбранный портал исчез при смене сценария, показываем самый
  // опасный из активных — интерфейс не должен оставаться пустым.
  const manualExists =
    manualId !== null && portals.some((item) => item.portal.id === manualId)
  const selectedId = manualExists
    ? manualId
    : (summary.attention[0]?.portal.id ?? portals[0]?.portal.id ?? null)

  // На узком экране карточка лежит ниже списка, поэтому переход из блока
  // «требует решения» доводит до неё, а не просто меняет выделение.
  const openCard = useCallback((portalId: string) => {
    setManualId(portalId)
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="app">
      <ShiftHeader onShowIntro={intro.show} />

      <nav className="tabs" aria-label="Разделы">
        <button
          type="button"
          className={`tab${tab === 'lab' ? ' tab--active' : ''}`}
          aria-current={tab === 'lab'}
          onClick={() => setTab('lab')}
        >
          Лаборатория
        </button>
        <button
          type="button"
          className={`tab${tab === 'worklog' ? ' tab--active' : ''}`}
          aria-current={tab === 'worklog'}
          onClick={() => setTab('worklog')}
        >
          AI Worklog
        </button>
      </nav>

      {tab === 'lab' ? (
        <>
          <FocusPanel onOpenCard={openCard} />
          <SummaryPanel onSelect={openCard} />

          {/* Порядок в разметке — по приоритету: список, карточка, журнал.
              На широком экране сетка визуально кладёт журнал под список,
              чтобы рядом с длинной карточкой не зияла пустая колонка. */}
          <div className="layout">
            <div className="layout__list">
              <PortalList selectedId={selectedId} onSelect={setManualId} />
            </div>
            <div className="layout__card" ref={cardRef}>
              <PortalCard portalId={selectedId} />
            </div>
            <div className="layout__log">
              <EventLog />
            </div>
          </div>

          <ConfirmDialog />
        </>
      ) : (
        <WorklogScreen />
      )}

      {intro.open && <Onboarding onClose={intro.close} />}
    </div>
  )
}
