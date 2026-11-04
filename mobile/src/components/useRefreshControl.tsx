import { useState } from 'react'
import { RefreshControl } from 'react-native'

import { useTheme } from '../theme'

/** Pull-to-refresh element for a scroll view, or undefined when there is nothing to refresh. */
export function useRefreshControl(onRefresh?: () => Promise<void>) {
  const theme = useTheme()
  const [refreshing, setRefreshing] = useState(false)
  if (!onRefresh) return undefined
  const refresh = async () => {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }
  return <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.subtle} colors={[theme.accent]} />
}
