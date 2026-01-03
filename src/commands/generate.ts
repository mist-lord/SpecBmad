import fs from 'fs'
import path from 'path'
import { log } from '@/utils/logger'
import { PerfTracer } from '@/utils/perf'
import { handleError } from '@/utils/error'
import { generateByStack } from '@/generator'
import { extractInputHints } from '@/utils/input'
import { implementCommand } from '@/commands/implement'
import { qaCommand } from '@/commands/qa'

interface GenerateOptions {
  input?: string
  stack?: string
  template?: string
  out?: string
  docOut?: string
  reportDir?: string
  autoImplement?: boolean
  qa?: boolean
  format?: 'markdown' | 'json'
  dryRun?: boolean
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true })
}

function writeFile(p: string, content: string, dryRun?: boolean) {
  ensureDir(path.dirname(p))
  if (!dryRun) fs.writeFileSync(p, content, 'utf-8')
}

export async function generateCommand(options: GenerateOptions): Promise<void> {
  const perf = new PerfTracer()
  try {
    perf.start('generate')
    log.info('开始生成完整项目与文档')
    const cwd = process.cwd()
    const outDir = options.out ? (path.isAbsolute(options.out) ? options.out : path.join(cwd, options.out)) : path.join(cwd, 'generated', 'project')
    const docDir = options.docOut ? (path.isAbsolute(options.docOut) ? options.docOut : path.join(cwd, options.docOut)) : path.join(cwd, 'docs')
    const reportDir = options.reportDir || path.join(process.cwd(), '.specbmad', 'artifacts')
    
    const hints = extractInputHints(options.input)
    const stack = options.stack || hints.preferredStack || 'ts-app'
    const projectName = path.basename(outDir)
    if (!options.dryRun) {
      ensureDir(outDir)
      ensureDir(docDir)
    }
  generateByStack({ stack, projectDir: outDir, projectName, template: options.template, dryRun: options.dryRun })
    if (!options.dryRun) {
      try {
        const jsEntry = path.join(outDir, 'src', 'index.js')
        if (!fs.existsSync(jsEntry)) {
          fs.mkdirSync(path.dirname(jsEntry), { recursive: true })
          fs.writeFileSync(jsEntry, `function main(){ console.log('hello') }\nif (typeof require !== 'undefined' && require.main === module){ main() }\n`, 'utf-8')
        }
      } catch (_e) { /* Ignore entry file creation errors */ }
    }

    if (options.autoImplement && !options.dryRun) {
      await implementCommand({ task: 'core-feature', review: true, format: 'markdown', reportDir })
    }

    if (options.qa && !options.dryRun) {
      await qaCommand({ type: 'unit', format: 'markdown', reportDir })
    }
    const docSummaryMd = `# 项目说明书\n\n- 名称: ${projectName}\n- 栈: ${stack}\n- 输入: ${options.input || '无'}\n- 模板: ${options.template || '默认'}\n- 运行模式: ${hints.runMode || '未指定'}\n`
    writeFile(path.join(docDir, '项目说明书.md'), docSummaryMd, options.dryRun)
    const sample = perf.end('generate')
    if (!options.dryRun) {
      log.success(`项目生成完成: ${outDir}`)
      log.success(`文档输出: ${path.join(docDir, '项目说明书.md')}`)
    } else {
      log.info('干跑模式，未写入文件')
    }
    log.info(`生成完成 (用时 ${sample.durationMs.toFixed(0)}ms)`) 
  } catch (error) {
    handleError(error, { command: 'generate' })
    throw error
  }
}
