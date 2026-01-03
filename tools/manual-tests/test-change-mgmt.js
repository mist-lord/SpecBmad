require('module-alias/register');
const path = require('path');
const moduleAlias = require('module-alias');

// 注册别名指向 dist 目录
moduleAlias.addAlias('@', path.join(__dirname, '../../dist'));

const { changeManager } = require('../../dist/core/change/manager');
const { PATHS, getProjectPath } = require('../../dist/utils/paths');
const fs = require('fs');

async function run() {
  console.log('=== 开始变更管理测试 ===');

  // 1. 创建提案
  console.log('1. 创建提案...');
  const proposal = changeManager.createProposal('Test Change', 'Add login feature');
  if (!proposal.id) throw new Error('Proposal ID missing');
  console.log(`✅ 提案已创建: ${proposal.id}`);

  // 2. 模拟添加 Delta
  console.log('2. 添加 Delta...');
  const proposalDir = getProjectPath(path.join(PATHS.CONFIG_DIR, 'changes', proposal.id));
  const deltas = [{
    specPath: 'auth/login.md',
    changes: [
      {
        type: 'ADDED',
        requirement: 'User Login',
        content: 'System shall support email login.',
        scenarios: ['Valid login', 'Invalid password']
      }
    ]
  }];
  fs.writeFileSync(path.join(proposalDir, 'deltas.json'), JSON.stringify(deltas, null, 2));
  console.log('✅ Delta 已写入');

  // 3. 批准提案
  console.log('3. 批准提案...');
  changeManager.updateStatus(proposal.id, 'approved');
  console.log('✅ 状态已更新为 approved');

  // 4. 应用提案
  console.log('4. 应用提案...');
  await changeManager.applyProposal(proposal.id);
  
  // 验证结果
  const specPath = getProjectPath(path.join(PATHS.SPECIFICATIONS_DIR, 'auth/login.md'));
  if (!fs.existsSync(specPath)) {
    throw new Error('❌ 规范文件未生成');
  }
  const content = fs.readFileSync(specPath, 'utf-8');
  if (!content.includes('User Login') || !content.includes('Valid login')) {
    throw new Error('❌ 规范内容不正确');
  }
  console.log('✅ 规范文件生成正确');

  // 验证状态
  const updated = changeManager.getProposal(proposal.id);
  if (updated?.status !== 'merged') {
    throw new Error('❌ 提案状态未更新为 merged');
  }
  console.log('✅ 提案状态已更新');

  console.log('=== 变更管理测试通过 ===');
}

run().catch(e => {
  console.error('❌ 测试失败:', e);
  process.exit(1);
});
