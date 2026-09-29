import { create } from 'zustand'

import type { SyncStatus } from '@/sync/engine'

/** Latest status reported by the sync engine (see SyncProvider). */
export const useSyncStore = create<SyncStatus>()(() => ({ state: 'idle', pending: 0, lastError: null, lastPulledAt: null }))

export function useSyncStatus(): SyncStatus {
  return useSyncStore()
}
