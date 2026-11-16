/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  // Development-only application actor selection; this does not authenticate a session.
  readonly VITE_CURRENT_USER_ID?: string;
}
