import fs from 'fs'
import path from 'path'

export type InputHints = {
  preferredStack?: string
  runMode?: string
}

export function extractInputHints(input?: string): InputHints {
  if (!input) return {}
  const p = path.isAbsolute(input) ? input : path.join(process.cwd(), input)
  if (!fs.existsSync(p)) return {}
  const ext = path.extname(p).toLowerCase()
  try {
    const raw = fs.readFileSync(p, 'utf-8')
    if (ext === '.json') {
      try {
        const obj = JSON.parse(raw)
        const preferredStack = typeof obj.preferredStack === 'string' ? obj.preferredStack : undefined
        const runMode = typeof obj.runMode === 'string' ? obj.runMode : undefined
        return { preferredStack, runMode }
      } catch {
        return {}
      }
    }
    if (ext === '.md' || ext === '.markdown' || ext === '.txt') {
      const lines = raw.split(/\r?\n/)
      let preferredStack: string | undefined
      let runMode: string | undefined
      for (const line of lines) {
        const m1 = line.match(/preferredStack\s*:\s*(\S+)/i) || line.match(/栈\s*[:：]\s*(\S+)/)
        if (m1 && !preferredStack) preferredStack = m1[1]
        const m2 = line.match(/runMode\s*:\s*(\S+)/i) || line.match(/运行模式\s*[:：]\s*(\S+)/)
        if (m2 && !runMode) runMode = m2[1]
      }
      return { preferredStack, runMode }
    }
    return {}
  } catch {
    return {}
  }
}

