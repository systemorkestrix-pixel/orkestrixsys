import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface StorageAdapter {
  upload(params: { id: string; fileName: string; extension: string; mimeType: string; buffer: Buffer }): Promise<{ url: string; storageKey: string }>;
  delete(storageUrlOrKey: string): Promise<void>;
}

export class LocalStorageAdapter implements StorageAdapter {
  private uploadsPath: string;

  constructor(uploadsPath: string) {
    this.uploadsPath = uploadsPath;
    mkdirSync(uploadsPath, { recursive: true });
  }

  async upload(params: { id: string; fileName: string; extension: string; mimeType: string; buffer: Buffer }) {
    const storedName = `${params.id}${params.extension}`;
    const filePath = join(this.uploadsPath, storedName);
    writeFileSync(filePath, params.buffer, { flag: 'wx' });
    return { url: `/uploads/${storedName}`, storageKey: storedName };
  }

  async delete(storageUrlOrKey: string) {
    const fileName = storageUrlOrKey.split('/').pop();
    if (!fileName) return;
    const filePath = join(this.uploadsPath, fileName);
    try {
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch {}
  }
}

export class SupabaseStorageAdapter implements StorageAdapter {
  private client: SupabaseClient;
  private bucket: string;

  constructor(url: string, serviceRoleKey: string, bucket = 'project-media') {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.bucket = bucket;
  }

  async upload(params: { id: string; fileName: string; extension: string; mimeType: string; buffer: Buffer }) {
    const storageKey = `media/${new Date().toISOString().slice(0, 10)}/${params.id}${params.extension}`;
    const { error } = await this.client.storage.from(this.bucket).upload(storageKey, params.buffer, {
      contentType: params.mimeType,
      upsert: true,
    });
    if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
    const { data } = this.client.storage.from(this.bucket).getPublicUrl(storageKey);
    return { url: data.publicUrl, storageKey };
  }

  async delete(storageUrlOrKey: string) {
    const marker = `/object/public/${this.bucket}/`;
    const storageKey = storageUrlOrKey.includes(marker)
      ? storageUrlOrKey.slice(storageUrlOrKey.indexOf(marker) + marker.length)
      : storageUrlOrKey;
    if (!storageKey) return;
    const { error } = await this.client.storage.from(this.bucket).remove([storageKey]);
    if (error) console.error(`Supabase Storage deletion error: ${error.message}`);
  }
}

export function createStorageAdapter(options: {
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  supabaseBucket?: string;
  uploadsPath: string;
}): StorageAdapter {
  if (options.supabaseUrl && options.supabaseServiceRoleKey) {
    return new SupabaseStorageAdapter(
      options.supabaseUrl,
      options.supabaseServiceRoleKey,
      options.supabaseBucket || 'project-media',
    );
  }
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error('Supabase Storage credentials are required in production.');
  }
  return new LocalStorageAdapter(options.uploadsPath);
}
