/// <reference types="vite/client" />
// Нужен ради import.meta.env.BASE_URL: пути к собственным ассетам собираются
// из base, а не зашиваются строкой, иначе сборка для GitHub Pages и тесты
// расходятся в путях.
