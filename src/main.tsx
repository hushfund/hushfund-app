import { Buffer } from 'buffer'
globalThis.Buffer = Buffer

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { Providers } from './providers.tsx'
import { NotesProvider } from './hooks/useNotes.tsx'
import { UiProvider } from './components/ui.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <NotesProvider>
        <UiProvider>
          <App />
        </UiProvider>
      </NotesProvider>
    </Providers>
  </StrictMode>,
)
