import path from 'path'
import { log } from '@/utils/logger'
import { PerfTracer } from '@/utils/perf'
import { handleError } from '@/utils/error'
import { generateByStack } from '@/generator'
import { runCommand } from '@/commands/run'
import fs from 'fs'

interface QuickOptions {
  text: string
  stack?: 'auto' | 'ts-cli' | 'ts-api' | 'py-cli' | 'ts-chat' | 'cpp-cli' | 'cpp-app'
  autoRun?: boolean
  out?: string
  docOut?: string
  dryRun?: boolean
}

function chooseStack(text: string, forced?: QuickOptions['stack']): 'ts-cli' | 'ts-api' | 'py-cli' | 'ts-chat' | 'cpp-cli' | 'cpp-app' {
  if (forced && forced !== 'auto') return forced
  const t = text.toLowerCase()
  const apiHints = ['http', 'api', '接口', '服务', 'server']
  const pyHints = ['python', '用 python', 'py ']
  const chatHints = ['chat', '聊天室', '聊天', 'websocket']
  const cppHints = ['c++', 'cpp', 'c plus plus', '用 c++', '用 cpp']
  if (chatHints.some(k => t.includes(k))) return 'ts-chat' as any
  if (cppHints.some(k => t.includes(k))) {
    // 如果提到 GUI、界面、窗口等，使用 cpp-app，否则使用 cpp-cli
    if (t.includes('gui') || t.includes('界面') || t.includes('窗口') || t.includes('应用')) {
      return 'cpp-app' as any
    }
    return 'cpp-cli' as any
  }
  if (apiHints.some(k => t.includes(k))) return 'ts-api'
  if (pyHints.some(k => t.includes(k))) return 'py-cli'
  return 'ts-cli'
}

export async function quickCommand(options: QuickOptions): Promise<void> {
  const perf = new PerfTracer()
  try {
    perf.start('quick')
    const text = options.text?.trim()
    if (!text) {
      log.error('请通过 --text 提供一句话需求')
      return
    }
    const cwd = process.cwd()
    const outDir = options.out ? (path.isAbsolute(options.out) ? options.out : path.join(cwd, options.out)) : path.join(cwd, 'generated', 'project')
    const docDir = options.docOut ? (path.isAbsolute(options.docOut) ? options.docOut : path.join(cwd, options.docOut)) : path.join(cwd, 'docs')
    const stack = chooseStack(text, options.stack)
    const projectName = path.basename(outDir)

    generateByStack({ stack, projectDir: outDir, projectName, template: undefined, dryRun: options.dryRun, vars: { message: text } })

    fs.mkdirSync(docDir, { recursive: true })
    const docSummaryMd = `# 项目说明书\n\n- 名称: ${projectName}\n- 栈: ${stack}\n- 需求: ${text}\n- 运行模式: ${stack === 'ts-api' ? '本地HTTP服务' : '命令行脚本'}\n`
    fs.writeFileSync(path.join(docDir, '项目说明书.md'), docSummaryMd, 'utf-8')

    let runOutput = ''
    if (options.autoRun && !options.dryRun) {
      if (stack === 'ts-api') {
        runOutput = await runCommand({ dir: outDir, stack: 'ts-api' })
      } else if (stack === 'py-cli') {
        runOutput = await runCommand({ dir: outDir, stack: 'py-cli' })
      } else if (stack === 'cpp-cli' || stack === 'cpp-app') {
        runOutput = await runCommand({ dir: outDir, stack: 'cpp-cli' })
      } else {
        runOutput = await runCommand({ dir: outDir, stack: 'ts-cli' })
      }
      fs.writeFileSync(path.join(docDir, 'run-output.txt'), runOutput, 'utf-8')
      log.success('运行输出已写入: ' + path.join(docDir, 'run-output.txt'))
    }

    const sample = perf.end('quick')
    log.success(`最小可运行 Demo 已生成 (用时 ${sample.durationMs.toFixed(0)}ms)`) 
  } catch (error) {
    handleError(error, { command: 'quick' })
    throw error
  }
}
