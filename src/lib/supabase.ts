import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Non-null when the app was built without Supabase settings; the auth gate shows it instead of crashing. */
export const supabaseConfigError: string | null =
  url && anonKey ? null : 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill it in.'

// Placeholders keep the module importable (tests, misconfigured builds); nothing calls the
// network while supabaseConfigError is set, because the gate never renders the app.
export const supabase = createClient<Database>(url ?? 'http://localhost:54321', anonKey ?? 'missing-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'daybook-auth',
  },
})

export type SupabaseClient = typeof supabase
