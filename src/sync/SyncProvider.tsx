import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { supabase } from '@/lib/supabase'
import { useSyncStore } from '@/store/sync'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import { CacheDb } from './cache'
import type { Entity } from './cache'
import { SyncEngine } from './engine'
import { createSupabaseRemote } from './remote'
import type { Remote } from './remote'

const ENTITY_LABEL: Record<Entity, string> = { task: 'task', category: 'category', classBlock: 'class' }

interface SyncProviderProps {
  userId: string
  children: ReactNode
  /** Injected in tests; defaults to the real Supabase backend. */
  remote?: Remote
}

/** Boots the signed-in user's cache and keeps it in sync for as long as it is mounted. */
export function SyncProvider({ userId, children, remote }: SyncProviderProps) {
  useEffect(() => {
    const cache = new CacheDb(userId)
    const engine = new SyncEngine({
      userId,
      cache,
      remote: remote ?? createSupabaseRemote(supabase),
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
      .then(async () => {
        if (!active) return
        await engine.start()
        if (active) await useTasksStore.getState().seedIfEmpty()
      })

    // Auth refreshes (and sign-ins in other tabs) are a good moment to push anything queued.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') void engine.sync()
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
      engine.stop()
      useTasksStore.getState().detach()
      useSyncStore.setState({ state: 'idle', pending: 0, lastError: null })
      cache.close()
    }
  }, [userId, remote])

  return children
}
