export type StorageUploadInput = {
  bucket: string
  path: string
  file: File | Blob
  contentType?: string
}

export type StorageUploadResult = {
  path: string
  url: string
}

export interface StorageProvider {
  /** Upload a file and return its public URL */
  upload(input: StorageUploadInput): Promise<StorageUploadResult>

  /** Delete a file at the given bucket+path */
  remove(bucket: string, path: string): Promise<void>

  /** Get a public URL for a file */
  getUrl(bucket: string, path: string): string

  /** Provider name for telemetry */
  readonly name: 'supabase' | 'cloudflare-r2'
}
