import { StrictMode, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import './index.css'
import './chartSetup.js'
import App from './App.jsx'
import { getTheme } from './theme/muiTheme.js'
import { TemaProvider, useTheme } from './hooks/useTheme.jsx'
import { CatalogProvider } from './context/CatalogContext.jsx'
import { DataVersionProvider } from './context/DataVersionContext.jsx'
import { ToastProvider } from './components/shared/Toast.jsx'
import { ConfirmProvider } from './components/shared/ConfirmDialog.jsx'

// Puente hacia el ThemeProvider de MUI: lee el tema del ÚNICO TemaProvider
// (montado abajo, una sola instancia de estado) para que SideNav (que
// dispara el toggle) y este puente (que arma el theme de MUI) queden
// sincronizados de verdad.
function MuiBridge({ children }) {
  const { tema } = useTheme();
  const theme = useMemo(() => getTheme(tema), [tema]);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}

function Root() {
  return (
    <TemaProvider>
      <MuiBridge>
        <ToastProvider>
          <ConfirmProvider>
            <DataVersionProvider>
              <CatalogProvider>
                <App />
              </CatalogProvider>
            </DataVersionProvider>
          </ConfirmProvider>
        </ToastProvider>
      </MuiBridge>
    </TemaProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
