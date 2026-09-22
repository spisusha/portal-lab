import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppRoot } from './AppRoot'
import './styles/theme.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Не найден корневой элемент #root')
}

createRoot(container).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
)
