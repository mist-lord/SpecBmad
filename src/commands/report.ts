import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
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
  .option('--format <fmt>', '输出格式 (markdown|json)', 'markdown')
  .action(async (options) => {
    try {
      log.info('开始生成最新运行报告...');

      // 加载配置以保持行为一致（不强依赖配置结构）
      const { config } = await import('@/utils/config');
      config.load();

      const artifactsDir = path.join(process.cwd(), '.bmad', 'artifacts');
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

      let outputContent = '';

      if (options.format === 'json') {
        const jsonOut = {
          generated_at: dateStr,
          artifacts_dir: artifactsDir,
          exists: existsMap,
          preview: {
            analysis: analysis ? Object.keys(analysis).slice(0, 6) : [],
            planning: planning ? Object.keys(planning).slice(0, 6) : [],
            solution: solution ? Object.keys(solution).slice(0, 6) : [],
            bmm: bmm ? Object.keys(bmm).slice(0, 6) : [],
          }
        };
        outputContent = JSON.stringify(jsonOut, null, 2);
      } else {
        outputContent = `# 最新运行报告\n\n` +
          `生成时间: ${dateStr}\n\n` +
          `## 产物存在性检查\n` +
          `- analysis.json: ${existsMap.analysis ? '✅' : '❌'}\n` +
          `- planning.json: ${existsMap.planning ? '✅' : '❌'}\n` +
          `- solution.json: ${existsMap.solution ? '✅' : '❌'}\n` +
          `- bmm.json: ${existsMap.bmm ? '✅' : '❌'}\n\n` +
          `> 产物目录: \`${artifactsDir}\`\n\n` +
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