import '@fontsource-variable/fraunces'
import '@fontsource-variable/instrument-sans'
import { MotionConfig } from 'framer-motion'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

import { App } from './App'
import { ImportLocalDialog } from './features/auth/ImportLocalDialog'
import { LOCAL_USER_ID, SyncProvider } from './sync/SyncProvider'
import './styles/index.css'

// Offline support: the service worker only registers in production builds.
registerSW({ immediate: true })

// Tasks live only in this browser, so ask it not to evict them when disk space runs low.
void navigator.storage?.persist?.()

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

createRoot(root).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <SyncProvider userId={LOCAL_USER_ID}>
        <App />
        <ImportLocalDialog />
      </SyncProvider>
    </MotionConfig>
  </StrictMode>,
)
