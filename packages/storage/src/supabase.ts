import { createClient } from '@ibizz/supabase'
import type { StorageProvider, StorageUploadInput, StorageUploadResult } from './types'

export class SupabaseStorage implements StorageProvider {
  readonly name = 'supabase' as const
  private client = createClient()

  async upload({ bucket, path, file, contentType }: StorageUploadInput): Promise<StorageUploadResult> {
    const { error } = await this.client.storage.from(bucket).upload(path, file, {
      contentType,
      upsert: true,
    })
    if (error) throw new Error(`Supabase upload fout: ${error.message}`)
    return { path, url: this.getUrl(bucket, path) }
  }

  async remove(bucket: string, path: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove([path])
    if (error) throw new Error(`Supabase remove fout: ${error.message}`)
  }

  getUrl(bucket: string, path: string): string {
    return this.client.storage.from(bucket).getPublicUrl(path).data.publicUrl
  }
}
