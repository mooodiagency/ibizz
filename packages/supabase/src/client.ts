import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

type SupaClient = ReturnType<typeof createBrowserClient<Database>>

let _client: SupaClient | null = null

/**
 * Singleton browser client. Voorkomt "Lock was stolen by another request"
 * door slechts één auth-managed client per browser tab te houden.
 */
export function createClient(): SupaClient {
  if (_client) return _client
  _client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return _client
}
