import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { log } from '@/utils/logger';
import { config } from '@/utils/config';

interface ConstitutionOptions {
  output?: string;
  template?: 'standard' | 'minimal';
  dryRun?: boolean;
}

export const constitutionCommand = new Command('constitution')
  .description('生成项目治理原则文档')
  .option('-o, --output <file>', '输出文件路径')
  .option('-t, --template <name>', '模板 (standard|minimal)', 'standard')
  .option('--dry-run', '预览模式，不生成文件')
  .action(async (options: ConstitutionOptions) => {
    try {
      const projectConfig = config.load();
      const defaultOut = projectConfig.spec_kit?.constitution_file || 'constitution.md';
      const outPath = options.output
        ? (path.isAbsolute(options.output) ? options.output : path.join(process.cwd(), options.output))
        : path.join(process.cwd(), defaultOut);

      const dir = path.dirname(outPath);
      fs.mkdirSync(dir, { recursive: true });

      const standard = `# 项目治理原则 (Constitution)\n\n## 宗旨\n- 保持规范驱动与敏捷协作的核心价值\n- 推动AI辅助开发的高效与可持续\n\n## 原则\n- 透明：需求、计划、决策与产出均可追踪\n- 责任：任务明确、角色清晰、结果可验\n- 质量：测试优先、自动化验证、持续改进\n- 安全：不暴露密钥、不提交敏感信息\n\n## 工作流\n- 规范 → 规划 → 设计 → 任务 → 实施 → QA → 部署\n\n## 角色\n- Analyst, Architect, Developer, QA, Scrum Master\n\n## 文档\n- 规范文档: .specbmad/specifications/requirements.md\n- 工作流状态: .bmad/workflow.state.json\n\n`;
      const minimal = `# 项目治理原则\n\n- 透明与责任\n- 质量与安全\n- 规范驱动协作\n`;

      const content = options.template === 'minimal' ? minimal : standard;

      if (options.dryRun) {
        log.info('预览模式 - 不会生成实际文件');
        console.log(content.split('\n').slice(0, 20).join('\n'));
        return;
      }

      fs.writeFileSync(outPath, content, 'utf-8');
      log.success(`治理原则文档已写入: ${outPath}`);
    } catch (error) {
      log.error(`生成治理原则失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

