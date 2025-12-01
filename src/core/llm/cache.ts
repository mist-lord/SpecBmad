import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config as projectConfig } from '@/utils/config';
import { log } from '@/utils/logger';
import { LLMOptions } from '@/types';

export interface CacheRecord {
  key: string;
  value: string;
  createdAt: number;
}

export class LLMCache {
  private config = projectConfig;
  private cacheDir: string;
  private cacheFile: string;
  private inMemory = new Map<string, CacheRecord>();
  private persistEnabled: boolean = process.env.NODE_ENV !== 'test';

  constructor() {
    try { this.config.load(); } catch {}
    const baseDir = path.join(process.cwd(), this.config.get('cacheDir') || '.specbmad/cache');
    this.cacheDir = baseDir;
    this.cacheFile = path.join(baseDir, 'llm.json');
    if (this.persistEnabled) {
      this.ensureFiles();
      this.loadFromDisk();
    }
  }

  private ensureFiles() {
    try {
      if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir, { recursive: true });
      if (!fs.existsSync(this.cacheFile)) fs.writeFileSync(this.cacheFile, '{}', 'utf-8');
    } catch (e) {
      log.debug(`初始化缓存文件失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private loadFromDisk() {
    try {
      const text = fs.readFileSync(this.cacheFile, 'utf-8');
      const json = JSON.parse(text || '{}');
      for (const [key, rec] of Object.entries(json as Record<string, CacheRecord>)) {
        this.inMemory.set(key, rec as CacheRecord);
      }
    } catch (e) {
      log.debug(`读取缓存失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private persist() {
    if (!this.persistEnabled) return;
    try {
      const obj: Record<string, CacheRecord> = {};
      for (const [k, v] of this.inMemory.entries()) obj[k] = v;
      fs.writeFileSync(this.cacheFile, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (e) {
      log.debug(`写入缓存失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  public makeKey(prompt: string, options: LLMOptions): string {
    const ctxStr = (options.context || [])
      .map(m => String(m))
      .join('\n');
    const raw = [
      options.model,
      options.temperature,
      options.maxTokens,
      options.systemPrompt,
      ctxStr,
      prompt
    ].map(v => (v === undefined ? '' : String(v))).join('|');
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  public get(key: string): string | null {
    const enabled = this.config.get('llmCacheEnabled');
    if (enabled === false) return null;

    const rec = this.inMemory.get(key);
    if (!rec) return null;
    const ttlSec = this.config.get('llmCacheTTLSeconds') ?? 3600; // 1h 默认
    const ageSec = (Date.now() - rec.createdAt) / 1000;
    if (ageSec > ttlSec) {
      this.inMemory.delete(key);
      this.persist();
      return null;
    }
    return rec.value;
  }

  public set(key: string, value: string) {
    const enabled = this.config.get('llmCacheEnabled');
    if (enabled === false) return;

    const rec: CacheRecord = { key, value, createdAt: Date.now() };
    this.inMemory.set(key, rec);
    this.persist();
  }
}

export const llmCache = new LLMCache();