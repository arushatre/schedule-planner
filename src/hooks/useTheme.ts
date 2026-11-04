import { useEffect, useLayoutEffect } from 'react'

import { applyAppearance } from '@/lib/appearance'
import { applyTheme, resolveTheme, systemPrefersDark } from '@/lib/theme'
import { useUiStore } from '@/store/ui'

/** Applies the chosen appearance and keeps <html data-theme> in sync with the preference and, for "system", the OS setting. */
export function useTheme(): void {
  const theme = useUiStore((state) => state.theme)
  const appearance = useUiStore((state) => state.appearance)

  // Layout effect so the chosen colors are in place before the first paint.
  useLayoutEffect(() => applyAppearance(appearance), [appearance])

  useEffect(() => {
    const update = () => applyTheme(resolveTheme(theme, systemPrefersDark()))
    update()
    if (theme !== 'system' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [theme])
}
