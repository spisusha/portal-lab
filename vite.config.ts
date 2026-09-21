// defineConfig берётся из 'vitest/config', а не из 'vite': только эта версия
// знает про поле `test`. С импортом из 'vite' сборка падает на TS2769.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// base обязателен для GitHub Pages: сайт живёт не в корне домена,
// а по пути /portal-lab/. Без него собранный бандл ищет ассеты в корне
// и страница открывается белой.
export default defineConfig({
  plugins: [react()],
  base: '/portal-lab/',
  test: {
    // Домен — чистый TypeScript без DOM, поэтому jsdom не нужен.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
