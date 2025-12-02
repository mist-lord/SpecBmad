import fs from 'fs'
import path from 'path'
import { BasePlugin, PluginConfig } from '@/core/plugin/base'
import { log } from '@/utils/logger'
import { PATHS } from '@/utils/paths'

export class ArtifactsIndexerPlugin extends BasePlugin {
  constructor(config: PluginConfig) { super(config) }
  protected async onInit(): Promise<void> { this.indexArtifacts(process.cwd()) }
  protected async onDestroy(): Promise<void> {}

  public indexArtifacts(root: string): void {
    try {
      const dir = path.join(root, PATHS.ARTIFACTS_DIR)
      fs.mkdirSync(dir, { recursive: true })
      const files = fs.readdirSync(dir).map(f => {
        const p = path.join(dir, f)
        const s = fs.statSync(p)
        return { name: f, path: p, size: s.size, mtime: s.mtime.toISOString() }
      })
      const md = ['# ARTIFACTS INDEX', '', ...files.map(x => `- ${x.name} (${x.size} bytes) - ${x.mtime}`)].join('\n')
      const mdPath = path.join(root, 'docs', 'ARTIFACTS_INDEX.md')
      fs.mkdirSync(path.dirname(mdPath), { recursive: true })
      fs.writeFileSync(mdPath, md, 'utf-8')
      const jsonPath = path.join(root, 'docs', 'ARTIFACTS_INDEX.json')
      fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), files }, null, 2), 'utf-8')
      log.success(`Artifacts 索引已生成: ${mdPath}`)
    } catch (e) {
      log.warn(`Artifacts 索引生成失败: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}

