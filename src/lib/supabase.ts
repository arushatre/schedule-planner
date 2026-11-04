import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Non-null when the app was built without Supabase settings; the auth gate shows it instead of crashing. */
export const supabaseConfigError: string | null =
  url && anonKey ? null : 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Locally, copy .env.example to .env and fill it in; for the hosted site, set them as GitHub repository variables and re-run the deploy.'

const KEEP_SIGNED_IN_KEY = 'daybook:keepSignedIn'

/** "Keep me signed in" (default on): remember the session across browser restarts. */
export const getKeepSignedIn = (): boolean => localStorage.getItem(KEEP_SIGNED_IN_KEY) !== 'false'

export const setKeepSignedIn = (keep: boolean): void => localStorage.setItem(KEEP_SIGNED_IN_KEY, String(keep))

/**
 * Session storage that follows the preference: localStorage survives restarts, sessionStorage ends
 * with the tab. Each write clears the other store so a session never lingers where it shouldn't.
 */
export const authStorage = {
  getItem: (key: string): string | null => localStorage.getItem(key) ?? sessionStorage.getItem(key),
  setItem: (key: string, value: string): void => {
    const [target, other] = getKeepSignedIn() ? [localStorage, sessionStorage] : [sessionStorage, localStorage]
    target.setItem(key, value)
    other.removeItem(key)
  },
  removeItem: (key: string): void => {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  },
}

// `||`, not `??`: CI passes unset repository variables as empty strings, and createClient throws on ''.
// Placeholders keep the module importable (tests, misconfigured builds); nothing calls the
// network while supabaseConfigError is set, because the gate never renders the app.
export const supabase = createClient<Database>(url || 'http://localhost:54321', anonKey || 'missing-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'daybook-auth',
    storage: authStorage,
  },
})

export type SupabaseClient = typeof supabase
