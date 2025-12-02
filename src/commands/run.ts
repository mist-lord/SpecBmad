import path from 'path'
import { spawn } from 'child_process'
import http from 'http'
import type { IncomingMessage } from 'http'
import { log } from '@/utils/logger'
import { PerfTracer } from '@/utils/perf'
import { handleError } from '@/utils/error'
import fs from 'fs'

interface RunOptions {
  dir?: string
  stack?: string
  python?: string
  args?: string
  port?: number
}

export async function runCommand(options: RunOptions): Promise<string> {
  const perf = new PerfTracer()
  try {
    perf.start('run')
    const cwd = process.cwd()
    const projectDir = options.dir ? (path.isAbsolute(options.dir) ? options.dir : path.join(cwd, options.dir)) : path.join(cwd, 'generated', 'project')
    const stack = options.stack || 'ts-app'
    log.info(`运行生成程序: ${projectDir} (${stack})`)
    let cmd = ''
    let args: string[] = []
    let output = ''
    if (stack === 'py-lib' || stack === 'py-cli') {
      cmd = options.python || 'python'
      args = ['main.py']
    } else if (stack === 'cpp-cli' || stack === 'cpp-app') {
      // C++ 项目需要先构建
      const buildDir = path.join(projectDir, 'build')
      const projectName = path.basename(projectDir)
      const executableName = projectName.replace(/[^a-zA-Z0-9_-]/g, '').replace(/-+/g, '_')
      const executablePath = path.join(buildDir, executableName)
      
      // 检查是否已构建
      if (!fs.existsSync(executablePath)) {
        log.warn('C++ 项目未构建，请先运行: cd build && cmake .. && make')
        return 'C++ 项目需要先构建。请运行: cd build && cmake .. && make'
      }
      
      cmd = executablePath
      args = []
    } else if (stack === 'ts-api' || stack === 'ts-chat') {
      cmd = 'node'
      args = ['src/server.js']
    } else {
      cmd = 'node'
      args = ['src/index.js']
      const jsEntry = path.join(projectDir, 'src', 'index.js')
      try {
        if (!fs.existsSync(jsEntry)) {
          fs.mkdirSync(path.dirname(jsEntry), { recursive: true })
          fs.writeFileSync(jsEntry, `function main(){ console.log('hello') }\nif (typeof require !== 'undefined' && require.main === module){ main() }\n`, 'utf-8')
          log.info(`已创建入口: ${jsEntry}`)
        }
      } catch (_e) { /* Ignore entry file creation errors */ }
      if (!fs.existsSync(jsEntry)) {
        args = ['-e', 'console.log("hello")']
      }
    }
    const env = { ...process.env }
    if (stack === 'ts-api' || stack === 'ts-chat') {
      env.PORT = String(options.port || 3000)
    }
    const proc = spawn(cmd, args, { cwd: projectDir, stdio: 'pipe', env })
    proc.stdout.on('data', (d) => { output += d.toString() })
    proc.stderr.on('data', (d) => { output += d.toString() })
    if (stack === 'ts-api' || stack === 'ts-chat') {
      const port = Number(env.PORT)
      await new Promise<void>((resolve) => setTimeout(resolve, 500))
      try {
        await new Promise<void>((resolve) => {
          const req = http.get({ host: '127.0.0.1', port, path: '/health' }, (res: IncomingMessage) => {
            res.setEncoding('utf-8')
            let body = ''
            res.on('data', (chunk: string) => { body += chunk })
            res.on('end', () => { output += `\nHEALTH ${res.statusCode}: ${body}`; resolve() })
          })
          req.on('error', () => resolve())
        })
      } catch (_e) { /* Ignore health check errors */ }
      try { proc.kill() } catch (_e) { /* Ignore kill errors */ }
    } else {
      await new Promise<void>((resolve, reject) => {
        proc.on('exit', (code) => {
          if (code === 0) resolve()
          else reject(new Error(`运行失败，退出码 ${code}`))
        })
        proc.on('error', (e) => reject(e))
      })
    }
    const sample = perf.end('run')
    log.success(`程序运行完成 (用时 ${sample.durationMs.toFixed(0)}ms)`) 
    try {
      const p = path.join(process.cwd(), 'docs', 'run-output.txt')
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, output, 'utf-8')
      log.info(`运行输出已写入: ${p}`)
    } catch (_e) { /* Ignore output file write errors */ }
    return output
  } catch (error) {
    handleError(error, { command: 'run' })
    throw error
  }
}
