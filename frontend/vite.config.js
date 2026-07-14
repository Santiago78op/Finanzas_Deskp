import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// FastAPI (app.py) sirve estáticos únicamente bajo /static y el index.html
// en /. base:'/static/' hace que Vite emita <script src="/static/assets/...">
// en el build de producción (con base:'/' por default 404earía, porque el
// archivo físico queda en static/assets/... pero la URL sería /assets/...).
export default defineConfig({
  plugins: [react()],
  base: '/static/',
  build: {
    outDir: '../static',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      // Con base:'/static/', Vite ya sirve index.html, los módulos y
      // public/ (fonts) bajo /static/ en dev — solo hace falta proxyear la
      // API. Un proxy amplio de /static tapaba el propio dev server de Vite.
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
