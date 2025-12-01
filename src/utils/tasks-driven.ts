import fs from 'fs'
import path from 'path'
import { PATHS, getArtifactsPath } from '@/utils/paths'

type ModulePlan = {
  name: string
  files: Array<{ path: string; content: string }>
  tests: Array<{ path: string; content: string }>
}

export function readTasksMarkdown(tasksPath: string): string {
  try {
    return fs.readFileSync(tasksPath, 'utf-8')
  } catch {
    return ''
  }
}

function hasAny(s: string, keys: string[]): boolean {
  const t = s.toLowerCase()
  return keys.some(k => t.includes(k.toLowerCase()))
}

export function planFromTasks(md: string): ModulePlan[] {
  const lines = md.split('\n')
  const text = lines.join(' ')
  const plans: ModulePlan[] = []

  if (hasAny(text, ['搜索', 'search'])) {
    plans.push({
      name: 'search',
      files: [
        { path: 'src/search/index.cjs', content: `function normalize(s){ return String(s||'').toLowerCase() }\nfunction search(components, query, opts={}){\n  const q = normalize(query)\n  return (components||[]).filter(c => {\n    const nameOk = normalize(c.name||'').includes(q)\n    const typeOk = !opts.type || c.type===opts.type\n    const statusOk = !opts.status || c.status===opts.status\n    return nameOk && typeOk && statusOk\n  })\n}\nmodule.exports = { search }\n` }
      ],
      tests: [
        { path: 'tests/search.test.cjs', content: `const { search } = require('../src/search/index.cjs')\nfunction assert(cond,msg){ if(!cond) throw new Error(msg||'assert') }\nconst comps=[{name:'SpecKit Core',type:'lib',status:'stable'},{name:'BMAD Planner',type:'svc',status:'beta'}]\nconst r1=search(comps,'core'); assert(r1.length===1,'search core should return 1')\nconst r2=search(comps,'plan',{type:'svc'}); assert(r2.length===1,'filter type svc should return 1')\nconsole.log('search.test.cjs OK')\n` }
      ]
    })
  }

  if (hasAny(text, ['版本', 'version'])) {
    plans.push({
      name: 'version',
      files: [
        { path: 'src/api/version.cjs', content: `const store=new Map()\nfunction addVersion(id,data){ if(!id) throw new Error('id required'); store.set(id,{...(data||{}),id}) }\nfunction getVersion(id){ return store.get(id)||null }\nfunction updateVersion(id,data){ if(!store.has(id)) throw new Error('not found'); store.set(id,{...(store.get(id)||{}),...(data||{})}) }\nfunction removeVersion(id){ store.delete(id) }\nmodule.exports={ addVersion, getVersion, updateVersion, removeVersion }\n` }
      ],
      tests: [
        { path: 'tests/version.test.cjs', content: `const v=require('../src/api/version.cjs')\nfunction assert(c,m){ if(!c) throw new Error(m||'assert') }\nv.addVersion('v1',{name:'1.0.0',status:'stable'})\nassert(v.getVersion('v1').name==='1.0.0','add/get works')\nv.updateVersion('v1',{status:'beta'})\nassert(v.getVersion('v1').status==='beta','update works')\nv.removeVersion('v1')\nassert(v.getVersion('v1')===null,'remove works')\nconsole.log('version.test.cjs OK')\n` }
      ]
    })
  }

  if (hasAny(text, ['日志', 'log'])) {
    plans.push({
      name: 'logging',
      files: [
        { path: 'src/logging/index.cjs', content: `function log(level,msg){ const ts=new Date().toISOString(); console.log(ts, level.toUpperCase(), '-', msg) }\nmodule.exports = { log }\n` }
      ],
      tests: [
        { path: 'tests/logging.test.cjs', content: `const { log } = require('../src/logging/index.cjs')\nlog('info','logging.test.cjs OK')\n` }
      ]
    })
  }

  if (hasAny(text, ['权限', 'auth'])) {
    plans.push({
      name: 'auth',
      files: [
        { path: 'src/auth/index.cjs', content: `function can(user,action){ if(!user) return false; const role=user.role||'guest'; if(role==='admin') return true; return ['read'].includes(action) }\nmodule.exports={ can }\n` }
      ],
      tests: [
        { path: 'tests/auth.test.cjs', content: `const { can } = require('../src/auth/index.cjs')\nfunction assert(c,m){ if(!c) throw new Error(m||'assert') }\nassert(can({role:'admin'},'write')===true,'admin write')\nassert(can({role:'user'},'read')===true,'user read')\nassert(can({role:'user'},'write')===false,'user write false')\nconsole.log('auth.test.cjs OK')\n` }
      ]
    })
  }

  return plans
}

export function writeSkeleton(projectDir: string, plans: ModulePlan[]): { files: string[]; tests: string[] } {
  const writtenFiles: string[] = []
  const writtenTests: string[] = []
  for (const p of plans) {
    for (const f of p.files) {
      const abs = path.join(projectDir, f.path)
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, f.content, 'utf-8')
      writtenFiles.push(abs)
    }
    for (const t of p.tests) {
      const abs = path.join(projectDir, t.path)
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, t.content, 'utf-8')
      writtenTests.push(abs)
    }
  }
  const runner = path.join(projectDir, 'tests', 'run-tests.cjs')
  const runnerContent = `const fs=require('fs');const path=require('path');\nconst dir=path.join(__dirname);\nconst files=fs.readdirSync(dir).filter(f=>f.endsWith('.test.cjs'));\nlet ok=0,fail=0;\nfor(const f of files){\n  try{ require(path.join(dir,f)); ok++; }catch(e){ console.error('FAIL',f, e.message); fail++; }\n}\nconsole.log('Tests:',{ok,fail}); if(fail>0) process.exit(1);\n`
  fs.mkdirSync(path.dirname(runner), { recursive: true })
  fs.writeFileSync(runner, runnerContent, 'utf-8')
  writtenTests.push(runner)
  return { files: writtenFiles, tests: writtenTests }
}

export function updatePackageJson(projectDir: string): void {
  const pkgPath = path.join(projectDir, 'package.json')
  try {
    const raw = fs.readFileSync(pkgPath, 'utf-8')
    const pkg = JSON.parse(raw)
    pkg.scripts = pkg.scripts || {}
    pkg.scripts.test = 'node tests/run-tests.cjs'
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf-8')
  } catch {}
}

export function buildTraceability(md: string, files: string[], tests: string[]): string {
  const lines = md.split('\n')
  const stories = lines.filter(l => /^\d+\.\s*\*\*用户故事/.test(l)).map((l, i) => ({ id: `story-${i+1}`, title: l.replace(/^\d+\.\s*\*\*|\*\*$/g,'') }))
  const tasks = lines.filter(l => /^-\s+/.test(l)).slice(0, 20).map((l, i) => ({ id: `task-${i+1}`, title: l.replace(/^-\s+/,'') }))
  const mapLines: string[] = []
  mapLines.push('## Traceability')
  mapLines.push('')
  for (const s of stories) {
    const matched = files.filter(f => f.toLowerCase().includes('search') || f.toLowerCase().includes('api') || f.toLowerCase().includes('version'))
    mapLines.push(`- ${s.id}: ${s.title}`)
    for (const m of matched.slice(0,3)) mapLines.push(`  - file: ${m}`)
  }
  for (const t of tasks.slice(0,10)) {
    const matched = tests.filter(f => f.toLowerCase().includes('test'))
    mapLines.push(`- ${t.id}: ${t.title}`)
    for (const m of matched.slice(0,2)) mapLines.push(`  - test: ${m}`)
  }
  mapLines.push('')
  return mapLines.join('\n')
}

export function writeConsistencyReport(root: string, coverage: { files: string[]; tests: string[]; tasks: number; stories: number }): void {
  const jsonPath = path.join(root, PATHS.ARTIFACTS_DIR, 'consistency.json')
  const mdPath = path.join(root, 'docs', '一致性报告.md')
  const payload = {
    coverage: {
      files: coverage.files.length,
      tests: coverage.tests.length,
      tasks: coverage.tasks,
      stories: coverage.stories
    },
    files: coverage.files,
    tests: coverage.tests,
    generatedAt: new Date().toISOString()
  }
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true })
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf-8')
  fs.mkdirSync(path.dirname(mdPath), { recursive: true })
  const md = `# 一致性报告\n\n- 生成时间: ${payload.generatedAt}\n- 代码文件数: ${payload.coverage.files}\n- 测试文件数: ${payload.coverage.tests}\n- 任务条目数: ${coverage.tasks}\n- 用户故事数: ${coverage.stories}\n\n## 文件列表\n${coverage.files.map(f=>`- ${f}`).join('\n')}\n\n## 测试列表\n${coverage.tests.map(f=>`- ${f}`).join('\n')}\n`
  fs.writeFileSync(mdPath, md, 'utf-8')
}

export function strengthenPlanning(root: string, modules: string[]): void {
  const planPath = path.join(root, PATHS.ARTIFACTS_DIR, 'planning.json')
  const plan = {
    planning_type: 'technical',
    technology_stack: { language: 'JavaScript', runtime: 'Node.js', test: 'custom runner' },
    modules: modules,
    api: modules.includes('version') ? [{ name: 'Version CRUD', endpoints: ['/version:add', '/version:get', '/version:update', '/version:remove'] }] : [],
    architecture: { layers: ['api', 'feature', 'utils'] },
    quality_assurance: { unit: true, integration: false, coverage_target: 0.8 },
    deployment_strategy: { mode: 'dev', steps: ['build', 'package', 'release'] },
    maintenance_plan: { logging: modules.includes('logging'), versioning: modules.includes('version') },
    metadata: { agent: 'Architect', scale: 1, timestamp: new Date().toISOString() }
  }
  fs.mkdirSync(path.dirname(planPath), { recursive: true })
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf-8')
}
