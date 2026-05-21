import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

type SupaClient = ReturnType<typeof createBrowserClient<Database>>

/**
 * Singleton via globalThis — overleeft Turbopack/Webpack HMR in dev.
 *
 * Module-level state wordt door HMR opnieuw geïnitialiseerd waardoor er
 * meerdere Supabase clients ontstaan die elkaars auth lock stelen
 * ("Lock was stolen by another request"). globalThis blijft wel staan.
 */
declare global {
  // eslint-disable-next-line no-var
  var __ibizzSupabaseClient: SupaClient | undefined
}

export function createClient(): SupaClient {
  if (globalThis.__ibizzSupabaseClient) return globalThis.__ibizzSupabaseClient
  globalThis.__ibizzSupabaseClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  return globalThis.__ibizzSupabaseClient
}
