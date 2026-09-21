import { useEffect } from 'react'

import { applyTheme, resolveTheme, systemPrefersDark } from '@/lib/theme'
import { useUiStore } from '@/store/ui'

/** Keeps <html data-theme> in sync with the preference and, for "system", the OS setting. */
export function useTheme(): void {
  const theme = useUiStore((state) => state.theme)

  useEffect(() => {
    const update = () => applyTheme(resolveTheme(theme, systemPrefersDark()))
    update()
    if (theme !== 'system' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [theme])
}
