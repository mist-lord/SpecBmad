import { Command } from 'commander';
import { changeManager } from '@/core/change/manager';
import { log } from '@/utils/logger';
import chalk from 'chalk';

let inquirerPromise: Promise<typeof import('inquirer')> | null = null;

async function loadInquirer() {
  if (!inquirerPromise) {
    inquirerPromise = import('inquirer');
  }
  const mod = await inquirerPromise;
  return mod.default;
}

export const changeCommand = new Command('change')
  .description('管理规范变更提案');

changeCommand
  .command('list')
  .description('列出所有变更提案')
  .action(() => {
    const proposals = changeManager.listProposals();
    if (proposals.length === 0) {
      log.info('暂无变更提案');
      return;
    }
    
    console.log(chalk.bold('\n变更提案列表:'));
    console.log('----------------------------------------');
    proposals.forEach(p => {
      const statusColor = {
        draft: chalk.gray,
        review: chalk.blue,
        approved: chalk.green,
        implemented: chalk.cyan,
        merged: chalk.magenta,
        rejected: chalk.red
      }[p.status] || chalk.white;
      
      console.log(`${chalk.yellow(p.id)} | ${statusColor(p.status.padEnd(10))} | ${p.title}`);
    });
    console.log('----------------------------------------\n');
  });

changeCommand
  .command('create')
  .description('创建新的变更提案')
  .option('-t, --title <title>', '提案标题')
  .option('-d, --desc <description>', '提案描述')
  .action(async (options) => {
    let { title, desc } = options;
    const inquirer = await loadInquirer();
    
    if (!title) {
      const ans = await inquirer.prompt([{
        type: 'input',
        name: 'title',
        message: '请输入提案标题:',
        validate: (input) => input.trim() !== '' || '标题不能为空'
      }]);
      title = ans.title;
    }
    
    if (!desc) {
      const ans = await inquirer.prompt([{
        type: 'input',
        name: 'desc',
        message: '请输入提案描述:',
        default: '无描述'
      }]);
      desc = ans.desc;
    }
    
    const proposal = changeManager.createProposal(title, desc);
    log.success(`变更提案已创建: ${chalk.yellow(proposal.id)}`);
    log.info(`请在 .specbmad/changes/${proposal.id}/ 目录下编辑详细内容`);
  });

changeCommand
  .command('show')
  .description('显示提案详情')
  .argument('<id>', '提案ID')
  .action((id) => {
    const proposal = changeManager.getProposal(id);
    if (!proposal) {
      log.error(`提案 ${id} 不存在`);
      return;
    }
    
    console.log(chalk.bold(`\n提案详情: ${id}`));
    console.log('----------------------------------------');
    console.log(`标题: ${proposal.title}`);
    console.log(`状态: ${proposal.status}`);
    console.log(`创建: ${proposal.createdAt}`);
    console.log(`描述: ${proposal.description}`);
    console.log('----------------------------------------\n');
    
    if (proposal.deltas && proposal.deltas.length > 0) {
      console.log(chalk.bold('包含变更:'));
      proposal.deltas.forEach(d => {
        console.log(`  - 文件: ${d.specPath}`);
        d.changes.forEach(c => {
          const color = c.type === 'ADDED' ? chalk.green : (c.type === 'REMOVED' ? chalk.red : chalk.blue);
          console.log(`    ${color(`[${c.type}]`)} ${c.requirement}`);
        });
      });
    }
  });

changeCommand
  .command('status')
  .description('更新提案状态')
  .argument('<id>', '提案ID')
  .argument('<status>', '新状态 (draft|review|approved|rejected|implemented|merged)')
  .action((id, status) => {
    try {
      changeManager.updateStatus(id, status);
      log.success(`提案 ${id} 状态已更新为 ${status}`);
    } catch (error) {
      log.error(error instanceof Error ? error.message : String(error));
    }
  });

changeCommand
  .command('apply')
  .description('应用变更提案到主规范 (合并)')
  .argument('<id>', '提案ID')
  .option('--force', '强制合并，忽略状态检查')
  .action(async (id, options) => {
    try {
      await changeManager.applyProposal(id, options.force);
    } catch (error) {
      log.error(error instanceof Error ? error.message : String(error));
    }
  });
