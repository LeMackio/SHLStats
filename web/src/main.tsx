import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Panel, Skeleton } from './components/site/Panel'
import { ThemeProvider } from './components/site/ThemeProvider'
import { DataProvider } from './data/DataProvider'

const failed = (
  <main id="app">
    <Panel title="Kunde inte ladda data"><p>SHL-datan kunde inte hämtas. Ladda om sidan om en stund.</p></Panel>
  </main>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <DataProvider loading={<main id="app" aria-busy="true"><Skeleton /></main>} failed={failed}>
        <App />
      </DataProvider>
    </ThemeProvider>
  </StrictMode>,
)
