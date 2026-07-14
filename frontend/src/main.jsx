import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './chartSetup.js'
import App from './App.jsx'
import { CatalogProvider } from './context/CatalogContext.jsx'
import { DataVersionProvider } from './context/DataVersionContext.jsx'
import { ToastProvider } from './components/shared/Toast.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <DataVersionProvider>
        <CatalogProvider>
          <App />
        </CatalogProvider>
      </DataVersionProvider>
    </ToastProvider>
  </StrictMode>,
)
