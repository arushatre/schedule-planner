import { createClient } from '@supabase/supabase-js'
import type { SupportedStorage } from '@supabase/supabase-js'
import Storage from 'expo-sqlite/kv-store'
import { AppState } from 'react-native'

import type { Database } from '@/types/database'

// Expo inlines EXPO_PUBLIC_* at build time, but only for literal `process.env.NAME` reads.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

/** Where "Forgot password?" emails send people (the web app's reset page); undefined uses the project's Site URL. */
export const webUrl: string | undefined = process.env.EXPO_PUBLIC_WEB_URL || undefined

/** Non-null when the app was built without Supabase settings; App shows it instead of the sign-in screen. */
export const supabaseConfigError: string | null =
  url && anonKey
    ? null
    : 'EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing. Copy mobile/.env.example to mobile/.env.local, fill it in, then restart `npx expo start`.'

const KEEP_KEY = 'daybook:keepSignedIn'
let keep = Storage.getItemSync(KEEP_KEY) !== 'false'
const memory = new Map<string, string>()

/**
 * "Keep me signed in" on: the session lives in the on-device key-value store and survives restarts.
 * Off: it lives only in memory, so closing the app signs you out.
 */
const authStorage: SupportedStorage = {
  getItem: (key) => (keep ? Storage.getItemSync(key) : (memory.get(key) ?? null)),
  setItem: (key, value) => {
    if (keep) Storage.setItemSync(key, value)
    else memory.set(key, value)
  },
  removeItem: (key) => {
    Storage.removeItemSync(key)
    memory.delete(key)
  },
}

export const keepSignedIn = (): boolean => keep

/** Call before signing in; it decides where the new session is stored. */
export function setKeepSignedIn(on: boolean): void {
  keep = on
  Storage.setItemSync(KEEP_KEY, String(on))
}

// Placeholders keep the module importable when misconfigured; nothing reaches the network then,
// because App renders the configuration error instead of the sign-in screen.
export const supabase = createClient<Database>(url || 'http://localhost:54321', anonKey || 'missing-anon-key', {
  auth: {
    storage: authStorage,
    storageKey: 'daybook-auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

// Supabase's React Native guidance: refresh tokens only while the app is in the foreground.
if (!supabaseConfigError) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh()
    else void supabase.auth.stopAutoRefresh()
  })
}
