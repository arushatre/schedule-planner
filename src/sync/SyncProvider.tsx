import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { useSyncStore } from '@/store/sync'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import { CacheDb } from './cache'
import type { Entity } from './cache'
import { SyncEngine } from './engine'
import { localRemote } from './remote'
import type { Remote } from './remote'

const ENTITY_LABEL: Record<Entity, string> = { task: 'task', category: 'category', classBlock: 'class' }

/** The single profile used without accounts; its data lives in the `daybook:local` IndexedDB. */
export const LOCAL_USER_ID = 'local'

interface SyncProviderProps {
  userId: string
  children: ReactNode
  /** Injected in tests; defaults to browser-only storage. */
  remote?: Remote
}

/** Boots the signed-in user's cache and keeps it in sync for as long as it is mounted. */
export function SyncProvider({ userId, children, remote }: SyncProviderProps) {
  useEffect(() => {
    const cache = new CacheDb(userId)
    const engine = new SyncEngine({
      userId,
      cache,
      remote: remote ?? localRemote,
      onPatch: (patch) => useTasksStore.getState().applyPatch(patch),
      onStatus: (status) => useSyncStore.setState(status),
      onRejected: (entity, error) =>
        useUiStore.getState().pushToast({
          message: `Couldn’t save a ${ENTITY_LABEL[entity]} change, so it was undone. ${error.message}`,
        }),
    })
    let active = true
    void useTasksStore
      .getState()
      .attach(engine)
      .then(() => {
        if (active) void engine.start()
      })

    // After the first successful pull (possibly long after an offline boot), the account's real
    // state is known: seed defaults for brand-new accounts, then offer any pre-accounts local data.
    const unsubscribePull = useSyncStore.subscribe((status, previous) => {
      if (!active || !status.lastPulledAt || previous.lastPulledAt) return
      const store = useTasksStore.getState()
      void store.seedIfEmpty().then(() => (active ? store.offerLocalImport() : undefined))
    })

    return () => {
      active = false
      unsubscribePull()
      engine.stop()
      useTasksStore.getState().detach()
      useSyncStore.setState({ state: 'idle', pending: 0, lastError: null, lastPulledAt: null })
      cache.close()
    }
  }, [userId, remote])

  return children
}
