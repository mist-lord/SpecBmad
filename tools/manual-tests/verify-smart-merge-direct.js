const moduleAlias = require('module-alias');
const path = require('path');
const fs = require('fs');

// 注册别名，指向 dist 目录
moduleAlias.addAlias('@', path.join(__dirname, '../../dist'));

// 引入编译后的 changeManager
// 注意：dist/core/change/manager.js
const { changeManager } = require('../../dist/core/change/manager');

const PROPOSAL_ID = 'CP-TEST-WEB-01';
const SPEC_FILE = path.join(process.cwd(), '.specbmad/specifications/user-auth.md');

async function verify() {
  try {
    console.log('Applying proposal via ChangeManager (Direct JS)...');
    
    // 模拟 force apply
    await changeManager.applyProposal(PROPOSAL_ID, true);
    
    console.log('Verifying spec file content...');
    const content = fs.readFileSync(SPEC_FILE, 'utf-8');
    
    let passed = true;

    if (content.includes('## OAuth Support')) {
      console.log('✅ New section "OAuth Support" found.');
    } else {
      console.error('❌ New section "OAuth Support" NOT found.');
      passed = false;
    }

    if (content.includes('### 验收场景') && content.includes('User clicks Google Login')) {
      console.log('✅ Scenarios found.');
    } else {
      console.error('❌ Scenarios NOT found.');
      passed = false;
    }

    if (content.includes('User needs to provide email, password, and optionally a 2FA code')) {
      console.log('✅ Modified content found (2FA added).');
    } else {
      console.error('❌ Modified content NOT found.');
      passed = false;
    }

    const loginMatches = content.match(/## Login/g);
    if (loginMatches && loginMatches.length === 1) {
      console.log('✅ "Login" section is unique (Smart Merge worked).');
    } else {
      console.error(`❌ "Login" section found ${loginMatches ? loginMatches.length : 0} times.`);
      passed = false;
    }

    console.log('\nFinal Spec Content:\n----------------\n' + content + '\n----------------');

    if (passed) {
      console.log('\n✨ Smart Merge Verification PASSED!');
    } else {
      console.error('\n💥 Smart Merge Verification FAILED!');
      process.exit(1);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verify();

