import '@fontsource-variable/fraunces'
import '@fontsource-variable/instrument-sans'
import { MotionConfig } from 'framer-motion'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

import { AuthProvider } from './auth/AuthProvider'
import { AuthGate } from './features/auth/AuthGate'
import './styles/index.css'

// Offline support: the service worker only registers in production builds.
registerSW({ immediate: true })

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

createRoot(root).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </MotionConfig>
  </StrictMode>,
)
