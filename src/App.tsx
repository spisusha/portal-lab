import { useState } from 'react'
import { useLab } from './state/labStore'
import { formatClock } from './domain/types'
import { SummaryPanel } from './ui/SummaryPanel'
import { PortalList } from './ui/PortalList'
import { PortalCard } from './ui/PortalCard'
import { EventLog } from './ui/EventLog'
import { Toolbar } from './ui/Toolbar'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { WorklogScreen } from './ui/WorklogScreen'

type Tab = 'lab' | 'worklog'

export function App() {
  const { state, portals, summary } = useLab()
  const [tab, setTab] = useState<Tab>('lab')
  const [manualId, setManualId] = useState<string | null>(null)

  // Если выбранный портал исчез при смене сценария, показываем самый
  // опасный из активных — интерфейс не должен оставаться пустым.
  const manualExists =
    manualId !== null && portals.some((item) => item.portal.id === manualId)
  const selectedId = manualExists
    ? manualId
    : (summary.attention[0]?.portal.id ?? portals[0]?.portal.id ?? null)

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1 className="app__title">Лаборатория нестабильных порталов</h1>
          <p className="app__subtitle">
            Пост смотрителя. Следите за риском, принимайте решения, фиксируйте
            всё в журнале.
          </p>
        </div>
        <div className="app__clock">
          Время смены {formatClock(state.clockMinutes)} · открыто{' '}
          {summary.active} · критичных {summary.critical}
        </div>
      </header>

      <nav className="tabs">
        <button
          type="button"
          className={`tab${tab === 'lab' ? ' tab--active' : ''}`}
          onClick={() => setTab('lab')}
        >
          Лаборатория
        </button>
        <button
          type="button"
          className={`tab${tab === 'worklog' ? ' tab--active' : ''}`}
          onClick={() => setTab('worklog')}
        >
          AI Worklog
        </button>
      </nav>

      {tab === 'lab' ? (
        <>
          <Toolbar />
          <SummaryPanel onSelect={setManualId} />
          <div className="layout">
            <div>
              <PortalList selectedId={selectedId} onSelect={setManualId} />
              <EventLog />
            </div>
            <PortalCard portalId={selectedId} />
          </div>
          <ConfirmDialog />
        </>
      ) : (
        <WorklogScreen />
      )}
    </div>
  )
}
