interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Test-only: set by `npm run test:integration` to run against the local stack. */
  readonly VITE_SUPABASE_INTEGRATION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
