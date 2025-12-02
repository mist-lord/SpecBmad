import fs from 'fs'
import path from 'path'
import { stackManager } from '@/core/stack'

export interface GeneratorOptions {
  stack: string
  projectDir: string
  projectName: string
  template?: string
  dryRun?: boolean
  vars?: Record<string, string>
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true })
}

function writeFile(p: string, content: string, dryRun?: boolean) {
  ensureDir(path.dirname(p))
  if (!dryRun) fs.writeFileSync(p, content, 'utf-8')
}

// 保留旧函数用于向后兼容，但实际逻辑已迁移到插件中
// 或者如果 manifest 存在，优先使用 manifest

export async function generateByStack(opts: GeneratorOptions) {
  if (!opts.dryRun) ensureDir(opts.projectDir)
  
  const manifest = loadManifest(opts.stack, opts.template)
  if (manifest) return applyManifest(opts, manifest)

  // 使用插件系统
  const plugin = stackManager.getPlugin(opts.stack)
  if (plugin) {
    return await plugin.generateSkeleton(opts)
  }

  // 回退到默认处理 (ts-app) 如果没有找到匹配的插件
  // 但实际上 ts-app 现在应该对应 ts 插件的一种配置，或者我们可以让 ts 插件处理默认情况
  // 这里为了兼容旧的 stack 名称 (如 ts-app, py-lib)，我们需要做一些映射
  
  if (opts.stack === 'ts-app') {
    const tsPlugin = stackManager.getPlugin('typescript')
    if (tsPlugin) return await tsPlugin.generateSkeleton(opts)
  }
  
  if (opts.stack === 'py-lib') {
    const pyPlugin = stackManager.getPlugin('python')
    if (pyPlugin) return await pyPlugin.generateSkeleton(opts)
  }
  
  if (opts.stack === 'cpp-cli' || opts.stack === 'cpp-app') {
    const cppPlugin = stackManager.getPlugin('cpp')
    if (cppPlugin) return await cppPlugin.generateSkeleton(opts)
  }

  // 默认回退到 TypeScript
  const defaultPlugin = stackManager.getPlugin('typescript')
  if (defaultPlugin) return await defaultPlugin.generateSkeleton(opts)
}

type Manifest = { files: Array<{ path: string; content: string }> }

function loadManifest(stack: string, _template?: string): Manifest | null {
  const base = path.join(__dirname, 'templates', stack)
  const file = path.join(base, 'manifest.json')
  try {
    const raw = fs.readFileSync(file, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function toPkgName(name: string) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '').replace(/-+/g, '_')
}

function applyManifest(opts: GeneratorOptions, manifest: Manifest) {
  const vars: Record<string, string> = {
    projectName: opts.projectName,
    packageName: toPkgName(opts.projectName),
    ...(opts.vars || {})
  }
  for (const f of manifest.files) {
    const rel = interpolate(f.path, vars)
    const content = interpolate(f.content, vars)
    writeFile(path.join(opts.projectDir, rel), content, opts.dryRun)
  }
}

function interpolate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? '')
}
