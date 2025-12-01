import path from 'path';
import fs from 'fs';
import { execa } from 'execa';
import chalk from 'chalk';

const CLI_PATH = path.resolve(__dirname, '../../dist/index.js');
const WORKSPACE_DIR = path.resolve(__dirname, '../../temp-vision-test');
const PROJECT_DIR = path.join(WORKSPACE_DIR, 'todo-cli');

// 模拟变更需求
const CHANGE_PROMPT = "Add a priority field to tasks (High, Medium, Low).";

async function run1toN() {
  console.log(chalk.bold.cyan('\n🚀 Vision Test Phase 2: 1 -> N (Iterative Development)\n'));

  if (!fs.existsSync(PROJECT_DIR)) {
    console.error(chalk.red('Error: Phase 1 project not found. Run Phase 1 test first.'));
    process.exit(1);
  }

  console.log(chalk.blue(`Change Prompt: "${CHANGE_PROMPT}"`));

  try {
    // 1. 创建变更提案
    // 模拟 'change create' 或 'analyze --proposal' 的流程
    console.log(chalk.yellow('\n[Analyst] Analyzing change request...'));
    
    const proposalId = 'CP-PRIORITY-001';
    const changesDir = path.join(PROJECT_DIR, '.specbmad/changes', proposalId);
    
    // 模拟 Analyst Agent 生成的变更提案
    const metadata = {
      id: proposalId,
      title: 'Add Task Priority',
      description: 'Add support for task priority levels.',
      status: 'approved',
      deltas: [{
        specPath: 'README.md', // 简单起见，我们修改 README 作为演示
        changes: [{
          type: 'ADDED',
          requirement: 'Task Priority',
          content: 'Tasks should have a priority field: High, Medium, or Low.'
        }]
      }]
    };

    // 确保 .specbmad 目录存在 (Phase 1 生成的骨架可能没有 .specbmad 目录，因为它只生成了代码)
    // 这里的测试假设用户已经 init 过 specbmad，或者我们帮他 init
    const configDir = path.join(PROJECT_DIR, '.specbmad/changes');
    fs.mkdirSync(configDir, { recursive: true });
    
    const proposalDir = path.join(configDir, proposalId);
    fs.mkdirSync(proposalDir, { recursive: true });
    
    fs.writeFileSync(path.join(proposalDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
    fs.writeFileSync(path.join(proposalDir, 'deltas.json'), JSON.stringify(metadata.deltas, null, 2));
    
    // Hack: create package.json for module-alias
    fs.writeFileSync(path.join(PROJECT_DIR, 'package.json'), JSON.stringify({ name: "todo-cli-test" }));
    
    console.log(chalk.green(`[System] Created change proposal: ${proposalId}`));

    // 2. 应用变更
    console.log(chalk.yellow('\n[System] Applying changes...'));
    
    // 调用 CLI apply
    await execa('node', [CLI_PATH, 'change', 'apply', proposalId, '--force'], { 
      cwd: PROJECT_DIR,
      stdio: 'inherit' 
    });

    // 3. 验证
    const readmePath = path.join(PROJECT_DIR, '.specbmad/specifications/README.md');
    // 注意：SpecDelta 指向的是 specifications 目录下的文件。
    // 如果 Phase 1 没有生成 spec 文件，apply 会创建它。
    
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, 'utf-8');
      if (content.includes('Task Priority')) {
        console.log(chalk.green('✓ Spec updated with priority requirement.'));
      } else {
        throw new Error('Spec update failed content check');
      }
    } else {
      throw new Error('Spec file not found');
    }

    console.log(chalk.bold.green('\n✅ Phase 2 Completed: Change applied successfully.\n'));

  } catch (error) {
    console.error(chalk.red('Phase 2 Failed:'), error);
    process.exit(1);
  }
}

run1toN();

