import { LabProvider } from './state/labStore'
import { LiveClockProvider } from './state/liveClock'
import { App } from './App'

/**
 * Полное дерево приложения: состояние лаборатории, поверх него — часы
 * живой смены, и только потом интерфейс.
 *
 * Порядок обязателен: таймер читает состояние и отправляет в него команду
 * перехода, значит живёт под `LabProvider`. Вынесено в отдельный файл,
 * чтобы точка входа и интеграционные тесты собирали одно и то же дерево,
 * а не два похожих.
 */
export function AppRoot() {
  return (
    <LabProvider>
      <LiveClockProvider>
        <App />
      </LiveClockProvider>
    </LabProvider>
  )
}
