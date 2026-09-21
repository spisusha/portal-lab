import { useCallback, useState } from 'react'
import { useLab } from './state/labStore'
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
  const { portals, summary, state } = useLab()
  const [tab, setTab] = useState<Tab>('lab')
  const [manualId, setManualId] = useState<string | null>(null)
  const intro = useOnboarding()

  // Если выбранный портал исчез при смене сценария, показываем самый
  // опасный из активных — камера не должна оставаться пустой.
  const manualExists =
    manualId !== null && portals.some((item) => item.portal.id === manualId)
  const selectedId = manualExists
    ? manualId
    : (summary.attention[0]?.portal.id ?? portals[0]?.portal.id ?? null)

  // Пока за смену не сделано ни одного решения, рекомендованная кнопка
  // помечена: первый шаг должен быть очевиден и после закрытия вступления.
  const firstStepPending = !state.log.some((entry) => entry.kind !== 'system')

  const select = useCallback((portalId: string) => {
    setManualId(portalId)
  }, [])

  // Действие закрепляет портал в камере. Иначе очередь пересортировывалась
  // сразу после нажатия, камера уезжала на другой портал, и сводка
  // «риск 72 → 60» относилась к тому, кого на экране уже нет.
  const act = useCallback((portalId: string) => {
    setManualId(portalId)
  }, [])

  return (
    <div className="shell">
      <TopBar tab={tab} onTabChange={setTab} onShowIntro={intro.show} />

      {tab === 'lab' ? (
        <main className="deck">
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
