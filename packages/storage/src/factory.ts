import { SupabaseStorage } from './supabase'
import type { StorageProvider } from './types'

let instance: StorageProvider | null = null

/**
 * Returns the currently configured storage provider.
 * Switch to Cloudflare R2 by setting STORAGE_PROVIDER=cloudflare-r2
 * (implementation komt later — nu Supabase als default).
 */
export function getStorage(): StorageProvider {
  if (instance) return instance
  // const provider = process.env.NEXT_PUBLIC_STORAGE_PROVIDER ?? 'supabase'
  // if (provider === 'cloudflare-r2') instance = new CloudflareR2Storage()
  instance = new SupabaseStorage()
  return instance
}
