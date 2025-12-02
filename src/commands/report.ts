import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { log } from '@/utils/logger';

function safeReadJson(filePath: string): any | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    log.warn(`读取JSON失败: ${filePath} -> ${(e as Error).message}`);
    return null;
  }
}

function summarizeSection(title: string, data: any): string {
  if (!data || typeof data !== 'object') {
    return `- 无可用数据`;
  }
  const keys = Object.keys(data);
  const previewKeys = keys.slice(0, 6);
  const lines: string[] = [];
  for (const k of previewKeys) {
    const v = data[k];
    let val: string;
    if (v === null || v === undefined) {
      val = 'null';
    } else if (typeof v === 'string') {
      val = v.length > 200 ? v.slice(0, 200) + '...' : v;
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      val = String(v);
    } else if (Array.isArray(v)) {
      val = `Array(${v.length})`;
    } else if (typeof v === 'object') {
      const subKeys = Object.keys(v);
      val = `Object(${subKeys.length} keys)`;
    } else {
      val = typeof v;
    }
    lines.push(`- ${k}: ${val}`);
  }
  if (keys.length > previewKeys.length) {
    lines.push(`- ... (${keys.length - previewKeys.length} 其他字段)`);
  }
  return lines.join('\n');
}

export const reportCommand = new Command('report')
  .description('汇总 .bmad/artifacts 产物生成最新运行报告')
  .option('-o, --output <file>', '输出报告文件路径', 'docs/最新运行报告.md')
  .option('--format <fmt>', '输出格式 (markdown|json|html|yaml)', 'markdown')
  .option('--project-dir <dir>', '待汇总的生成项目目录')
  .action(async (options) => {
    try {
      log.info('开始生成最新运行报告...');

      // 加载配置以保持行为一致（不强依赖配置结构）
      const { config } = await import('@/utils/config');
      config.load();

      const { PATHS, getProjectPath } = await import('@/utils/paths');
      const artifactsDir = getProjectPath(PATHS.ARTIFACTS_DIR);
      const files = {
        analysis: path.join(artifactsDir, 'analysis.json'),
        planning: path.join(artifactsDir, 'planning.json'),
        solution: path.join(artifactsDir, 'solution.json'),
        bmm: path.join(artifactsDir, 'bmm.json'),
      } as const;

      const analysis = safeReadJson(files.analysis);
      const planning = safeReadJson(files.planning);
      const solution = safeReadJson(files.solution);
      const bmm = safeReadJson(files.bmm);

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

      const existsMap = {
        analysis: !!analysis,
        planning: !!planning,
        solution: !!solution,
        bmm: !!bmm,
      };

      const projDir = options.projectDir
        ? (path.isAbsolute(options.projectDir) ? options.projectDir : path.join(process.cwd(), options.projectDir))
        : path.join(process.cwd(), 'generated', 'project');
      const projExists = fs.existsSync(projDir);
      const projEntries = projExists ? fs.readdirSync(projDir) : [];
      const projDocsPath = path.join(process.cwd(), 'docs', '项目说明书.md');
      const projDocsExists = fs.existsSync(projDocsPath);
      const runOutputPath = path.join(process.cwd(), 'docs', 'run-output.txt');
      const runOutputExists = fs.existsSync(runOutputPath);
      const runOutput = runOutputExists ? fs.readFileSync(runOutputPath, 'utf-8') : '';

      let outputContent = '';

      if (options.format === 'json') {
        const jsonOut = {
          generated_at: dateStr,
          artifacts_dir: artifactsDir,
          exists: existsMap,
          project: {
            dir: projDir,
            exists: projExists,
            entries: projEntries.slice(0, 20)
          },
          run: {
            output_file: runOutputPath,
            has_output: runOutputExists,
          },
          preview: {
            analysis: analysis ? Object.keys(analysis).slice(0, 6) : [],
            planning: planning ? Object.keys(planning).slice(0, 6) : [],
            solution: solution ? Object.keys(solution).slice(0, 6) : [],
            bmm: bmm ? Object.keys(bmm).slice(0, 6) : [],
          }
        };
        outputContent = JSON.stringify(jsonOut, null, 2);
      } else if (options.format === 'yaml') {
        const jsonOut = {
          generated_at: dateStr,
          artifacts_dir: artifactsDir,
          exists: existsMap,
          project: {
            dir: projDir,
            exists: projExists,
            entries: projEntries.slice(0, 20)
          },
          run: {
            output_file: runOutputPath,
            has_output: runOutputExists,
          },
          preview: {
            analysis: analysis ? Object.keys(analysis).slice(0, 6) : [],
            planning: planning ? Object.keys(planning).slice(0, 6) : [],
            solution: solution ? Object.keys(solution).slice(0, 6) : [],
            bmm: bmm ? Object.keys(bmm).slice(0, 6) : [],
          }
        } as any;
        outputContent = YAML.stringify(jsonOut);
      } else if (options.format === 'html') {
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>最新运行报告</title><style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;padding:24px}code{background:#f6f8fa;padding:2px 4px;border-radius:3px}pre{background:#f6f8fa;padding:12px;border-radius:6px;overflow:auto}</style></head><body><h1>最新运行报告</h1><p>生成时间: ${dateStr}</p><h2>产物存在性检查</h2><ul><li>analysis.json: ${existsMap.analysis ? '✅' : '❌'}</li><li>planning.json: ${existsMap.planning ? '✅' : '❌'}</li><li>solution.json: ${existsMap.solution ? '✅' : '❌'}</li><li>bmm.json: ${existsMap.bmm ? '✅' : '❌'}</li></ul><p>产物目录: <code>${artifactsDir}</code></p><h2>项目结构概览</h2><ul>${projExists ? projEntries.slice(0,20).map(e=>`<li>${e}</li>`).join('') : '<li>未发现生成项目目录</li>'}</ul>${projDocsExists ? `<p>项目说明书: <code>${projDocsPath}</code></p>` : ''}${runOutputExists ? `<h2>运行输出片段</h2><pre>${escapeHtml(runOutput.slice(0,500))}</pre>` : ''}<h2>分析概览</h2><pre>${escapeHtml(summarizeSection('analysis', analysis))}</pre><h2>规划概览</h2><pre>${escapeHtml(summarizeSection('planning', planning))}</pre><h2>解决方案概览</h2><pre>${escapeHtml(summarizeSection('solution', solution))}</pre><h2>商业模型概览</h2><pre>${escapeHtml(summarizeSection('bmm', bmm))}</pre></body></html>`;
        outputContent = html;
      } else {
        outputContent = `# 最新运行报告\n\n` +
          `生成时间: ${dateStr}\n\n` +
          `## 产物存在性检查\n` +
          `- analysis.json: ${existsMap.analysis ? '✅' : '❌'}\n` +
          `- planning.json: ${existsMap.planning ? '✅' : '❌'}\n` +
          `- solution.json: ${existsMap.solution ? '✅' : '❌'}\n` +
          `- bmm.json: ${existsMap.bmm ? '✅' : '❌'}\n\n` +
          `> 产物目录: \`${artifactsDir}\`\n\n` +
          `## 项目结构概览\n` +
          `${projExists ? projEntries.slice(0, 20).map((e) => `- ${e}`).join('\n') : '- 未发现生成项目目录'}\n\n` +
          `${projDocsExists ? `> 项目说明书: \`${projDocsPath}\`\n\n` : ''}` +
          `${runOutputExists ? `## 运行输出片段\n\n\`\`\`\n${runOutput.slice(0, 500)}\n\`\`\`\n\n` : ''}` +
          `## 分析 (analysis.json) 概览\n` +
          `${summarizeSection('analysis', analysis)}\n\n` +
          `## 规划 (planning.json) 概览\n` +
          `${summarizeSection('planning', planning)}\n\n` +
          `## 解决方案 (solution.json) 概览\n` +
          `${summarizeSection('solution', solution)}\n\n` +
          `## 商业模型 (bmm.json) 概览\n` +
          `${summarizeSection('bmm', bmm)}\n\n` +
          `---\n` +
          `> 注：本报告为快速汇总视图。若字段较多，仅展示少量关键键名及类型/预览。`;
      }

      const outPath = path.isAbsolute(options.output) ? options.output : path.join(process.cwd(), options.output);
      const outDir = path.dirname(outPath);
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      fs.writeFileSync(outPath, outputContent, 'utf-8');

      log.success(`报告已生成: ${outPath}`);
    } catch (error) {
      log.error('生成报告失败:', error);
      process.exitCode = 1;
    }
  });

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
}
