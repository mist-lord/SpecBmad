const http = require('http');
const fs = require('fs');
const path = require('path');

const PROPOSAL_ID = 'CP-TEST-WEB-01';
const SPEC_FILE = path.join(process.cwd(), '.specbmad/specifications/user-auth.md');

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: data ? JSON.parse(data) : null,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function verify() {
  try {
    // 1. 等待服务器启动
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('Applying proposal via API...');
    
    // 2. 调用 Apply API
    const res = await request(`/api/changes/${PROPOSAL_ID}/apply`, 'POST', { force: true });
    console.log('Apply Response Status:', res.status);
    if (res.status !== 200) {
      console.error('Apply failed:', res.body);
      process.exit(1);
    }

    // 3. 验证文件内容
    console.log('Verifying spec file content...');
    const content = fs.readFileSync(SPEC_FILE, 'utf-8');
    
    let passed = true;

    // 检查新增章节
    if (content.includes('## OAuth Support')) {
      console.log('✅ New section "OAuth Support" found.');
    } else {
      console.error('❌ New section "OAuth Support" NOT found.');
      passed = false;
    }

    // 检查新增场景
    if (content.includes('### 验收场景') && content.includes('User clicks Google Login')) {
      console.log('✅ Scenarios found.');
    } else {
      console.error('❌ Scenarios NOT found.');
      passed = false;
    }

    // 检查修改章节
    if (content.includes('User needs to provide email, password, and optionally a 2FA code')) {
      console.log('✅ Modified content found (2FA added).');
    } else {
      console.error('❌ Modified content NOT found.');
      passed = false;
    }

    // 检查原始部分是否保留 (简单的追加可能导致重复，AST合并应避免)
    const loginMatches = content.match(/## Login/g);
    if (loginMatches && loginMatches.length === 1) {
      console.log('✅ "Login" section is unique (Smart Merge worked).');
    } else {
      console.error(`❌ "Login" section found ${loginMatches ? loginMatches.length : 0} times (Duplicate or missing).`);
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

