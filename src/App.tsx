import { useCallback, useState } from 'react'
import { useLab } from './state/labStore'
import { useClockBlock } from './state/liveClock'
import { TopBar, type Tab } from './ui/TopBar'
import { PortalCamera } from './ui/PortalCamera'
import { DecisionBench } from './ui/DecisionBench'
import { PortalQueue } from './ui/PortalQueue'
import { LabStatus } from './ui/LabStatus'
import { Archive } from './ui/Archive'
import { ChangeFlash } from './ui/ChangeFlash'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { Onboarding, useOnboarding } from './ui/Onboarding'
import { WorklogScreen } from './ui/WorklogScreen'
import { ShiftComplete } from './ui/ShiftComplete'
import { LiveComplete } from './ui/LiveComplete'
import { currentCycle, isActive } from './domain/types'

/**
 * Экран собран по одному вопросу: «что делать прямо сейчас».
 *
 *  1. Верхняя панель — кто здесь, сколько времени, что горит, как двинуть цикл.
 *  2. Камера портала — самый опасный портал крупно, с рангом, риском,
 *     главной угрозой и одним рекомендованным действием.
 *  3. Панель решения — четыре действия, у каждого написано последствие.
 *  4. Очередь — остальные порталы, самые опасные сверху.
 *  5. Подробности (формула, история, журнал) — в раскрывающихся блоках.
 *
 * Прежняя версия показывала сначала сводку и таблицу, потом карточку,
 * а рекомендацию — где-то под разбором формулы. Порядок был удобен вёрстке,
 * а не человеку.
 */
export function App() {
  const { portals, summary, state, dispatch, directive } = useLab()
  const [tab, setTab] = useState<Tab>('lab')
  const [manualId, setManualId] = useState<string | null>(null)
  const [showFinalLog, setShowFinalLog] = useState(false)
  const intro = useOnboarding()

  // Время живой смены не идёт, пока человек читает. Порталы не имеют права
  // схлопываться за спиной у того, кто открыл инструкцию или ушёл в отчёт.
  useClockBlock('intro', intro.open ? 'Таймер приостановлен, пока открыта инструкция.' : null)
  useClockBlock(
    'worklog',
    tab === 'worklog' ? 'Таймер приостановлен, пока открыт AI Worklog.' : null,
  )

  // Если выбранный портал исчез при смене сценария, показываем самый
  // опасный из активных — камера не должна оставаться пустой.
  const manualExists =
    manualId !== null && portals.some((item) => item.portal.id === manualId && isActive(item.portal))
  const current = currentCycle(state)
  const nextUnprocessed = [...portals]
    .filter((item) => isActive(item.portal) && item.portal.decisionCycle !== current)
    .sort((a, b) => b.risk.score - a.risk.score)[0]
  const selectedId = manualExists
    ? manualId
    : (nextUnprocessed?.portal.id ?? summary.attention[0]?.portal.id ?? portals.find((item) => isActive(item.portal))?.portal.id ?? null)

  // Пока за смену не сделано ни одного решения, рекомендованная кнопка
  // помечена: первый шаг должен быть очевиден и после закрытия вступления.
  const firstStepPending = !state.log.some((entry) => entry.kind !== 'system')

  const select = useCallback((portalId: string) => {
    setManualId(portalId)
  }, [])

  // Действие закрепляет портал в камере. Иначе очередь пересортировывалась
  // сразу после нажатия, камера уезжала на другой портал, и сводка
  // «риск 72 → 60» относилась к тому, кого на экране уже нет.
  const act = useCallback((_portalId: string) => {
    // После успешного решения камера должна перейти к следующему
    // необработанному порталу. `null` отдаёт выбор доменному порядку риска.
    setManualId(null)
  }, [])

  const unresolved = portals.filter(
    (item) => isActive(item.portal) && item.portal.decisionCycle !== current,
  ).length

  if (state.shiftStatus === 'COMPLETE' && tab === 'lab') {
    return (
      <div className="shell">
        <TopBar tab={tab} onTabChange={setTab} onShowIntro={intro.show} />
        <main className="deck deck--complete">
          {/* Живая смена получает свой итог: счёт, ранг и разбор решений.
              Демонстрационным сценариям всё это не нужно — их задача
              показать краевые случаи, а не соревноваться. */}
          {state.scenario === 'live' ? (
            <LiveComplete
              showLog={showFinalLog}
              onShowLog={() => setShowFinalLog(true)}
              onReset={() => {
                setShowFinalLog(false)
                setManualId(null)
              }}
            />
          ) : (
            <ShiftComplete
              showLog={showFinalLog}
              onShowLog={() => setShowFinalLog(true)}
              onRestart={() => {
                setShowFinalLog(false)
                setManualId(null)
                dispatch({ type: 'LOAD_SCENARIO', scenario: state.scenario, confirmed: true })
              }}
            />
          )}
          {showFinalLog && <Archive portalId={null} />}
        </main>
      </div>
    )
  }

  return (
    <div className="shell">
      <TopBar tab={tab} onTabChange={setTab} onShowIntro={intro.show} />

      {tab === 'lab' ? (
        <main className="deck">
          <div className="shift-progress" aria-label="Прогресс смены">
            <span className="shift-progress__goal">
              Сохраните ценные порталы и не допустите аварий
            </span>
            <strong>Цикл {Math.min(current + 1, 6)} из 6</strong>
            <span>Осталось циклов: {Math.max(0, 6 - current)}</span>
            {unresolved === 0 && summary.active > 0 && (
              <span className="shift-progress__ready">
                Все доступные решения этого цикла приняты. Можно перейти к следующему циклу.
              </span>
            )}
          </div>

          {/* Директива стоит вплотную к прогрессу смены и не заводит себе
              отдельной панели: это вторая задача, а не вторая цель. */}
          {directive && (
            <p
              className={`directive directive--${directive.met ? 'met' : 'pending'}`}
              aria-label={`Директива смены: ${directive.directive.title}`}
            >
              <span className="directive__label">
                Директива {directive.met ? '· выполняется' : '· пока не выполнена'}
              </span>
              <span className="directive__text">
                {directive.directive.title}
                <span className="directive__rule"> — {directive.directive.rule}</span>
              </span>
            </p>
          )}
          <PortalCamera
            portalId={selectedId}
            onSelect={select}
            onAct={act}
            firstStepPending={firstStepPending}
          />

          <DecisionBench portalId={selectedId} onAct={act} />

          <div className="deck__rail">
            <PortalQueue selectedId={selectedId} onSelect={select} />
            <LabStatus />
          </div>

          <div className="deck__archive">
            <Archive portalId={selectedId} />
          </div>
        </main>
      ) : (
        <main className="deck deck--reading">
          <WorklogScreen />
        </main>
      )}

      <ChangeFlash />
      <ConfirmDialog />

      {intro.open && <Onboarding onClose={intro.close} />}
    </div>
  )
}
