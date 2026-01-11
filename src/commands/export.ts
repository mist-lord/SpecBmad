import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { log } from '@/utils/logger';
import { PATHS } from '@/utils/paths';
import chalk from 'chalk';

export const exportCommand = new Command('export')
  .description('导出配置或规则到其他工具');

exportCommand
  .command('rules')
  .description('导出规格驱动开发规则到 IDE (Cursor/Cline/Windsurf)')
  .option('--ide <type>', '指定 IDE 类型: cursor, cline, windsurf, all', 'all')
  .action(async (options) => {
    const { ide } = options;
    const projectDir = process.cwd();

    const rulesContent = `
# Spec-Driven Development Rules

You are an AI assistant working on a project managed by SpecKit-BMAD. 
The source of truth for requirements and specifications is located in:
- \`${PATHS.SPECIFICATIONS_DIR}/\`

Current active tasks and artifacts are in:
- \`${PATHS.ARTIFACTS_DIR}/\`

## Workflow Guidelines

1. **Check Specs First**: Before implementing any code, always read the relevant specifications in \`${PATHS.SPECIFICATIONS_DIR}/\`.
2. **Follow Task List**: Refer to \`${PATHS.ARTIFACTS_DIR}/tasks.md\` (or similar) for the current implementation plan.
3. **Update Specs if Needed**: If the implementation deviates from the spec, propose an update to the specification files.
4. **Report Progress**: When you complete a task, summarize what was changed.

## Directory Structure
- \`${PATHS.CONFIG_DIR}/\`: SpecKit-BMAD configuration and state.
- \`${PATHS.SPECIFICATIONS_DIR}/\`: Core specifications (requirements, architecture, etc).
- \`${PATHS.ARTIFACTS_DIR}/\`: Generated artifacts from the workflow.
- \`${PATHS.CONFIG_DIR}/changes/\`: Active change proposals (proposals, spec deltas).
`;

    try {
      if (ide === 'cursor' || ide === 'all') {
        const cursorPath = path.join(projectDir, '.cursorrules');
        fs.writeFileSync(cursorPath, rulesContent, 'utf-8');
        log.success(`已导出 Cursor 规则: ${chalk.cyan('.cursorrules')}`);
      }

      if (ide === 'cline' || ide === 'all') {
        const clineDir = path.join(projectDir, '.clinerules');
        if (!fs.existsSync(clineDir)) fs.mkdirSync(clineDir, { recursive: true });
        const clinePath = path.join(clineDir, 'spec-rules.md');
        fs.writeFileSync(clinePath, rulesContent, 'utf-8');
        log.success(`已导出 Cline 规则: ${chalk.cyan('.clinerules/spec-rules.md')}`);
      }

      if (ide === 'windsurf' || ide === 'all') {
        const windsurfDir = path.join(projectDir, '.windsurf', 'workflows');
        if (!fs.existsSync(windsurfDir)) fs.mkdirSync(windsurfDir, { recursive: true });
        
        const proposalWorkflow = `
# OpenSpec Proposal Workflow
This workflow helps you draft a change proposal using SpecKit-BMAD principles.

1. Read current specs in \`${PATHS.SPECIFICATIONS_DIR}/\`.
2. Draft a new change proposal in \`${PATHS.CONFIG_DIR}/changes/CP-NEW/\`.
3. Wait for user review.
`;
        fs.writeFileSync(path.join(windsurfDir, 'openspec-proposal.md'), proposalWorkflow, 'utf-8');
        log.success(`已导出 Windsurf 工作流: ${chalk.cyan('.windsurf/workflows/openspec-proposal.md')}`);
      }

      log.info(chalk.green('\n✅ 导出完成！现在你可以在 IDE 中直接使用这些规则引导 AI 助手了。'));
    } catch (error) {
      log.error(`导出失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
