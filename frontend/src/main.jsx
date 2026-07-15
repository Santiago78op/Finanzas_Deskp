import { StrictMode, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import './index.css'
import './chartSetup.js'
import App from './App.jsx'
import { getTheme } from './theme/muiTheme.js'
import { useTheme } from './hooks/useTheme.js'
import { CatalogProvider } from './context/CatalogContext.jsx'
import { DataVersionProvider } from './context/DataVersionContext.jsx'
import { ToastProvider } from './components/shared/Toast.jsx'
import { ConfirmProvider } from './components/shared/ConfirmDialog.jsx'

// Envoltorio propio (en vez de armar el theme MUI dentro de App.jsx) porque
// useTheme() ya se llama de forma independiente en TopNav/DashboardView —
// cada instancia solo lee/sincroniza el mismo data-theme, así que agregar
// una más acá no rompe nada y evita tocar App.jsx para esto.
function Root() {
  const { tema } = useTheme();
  const theme = useMemo(() => getTheme(tema), [tema]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastProvider>
        <ConfirmProvider>
          <DataVersionProvider>
            <CatalogProvider>
              <App />
            </CatalogProvider>
          </DataVersionProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
