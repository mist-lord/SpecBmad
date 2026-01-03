const http = require('http');

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
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

async function runTests() {
  try {
    console.log('Testing API Server...');

    // 1. Test Status API
    console.log('\n1. GET /api/status');
    const status = await request('/api/status');
    console.log('Status:', status.status);
    console.log('Project Name:', status.body.project.name);

    // 2. Test Changes API (List)
    console.log('\n2. GET /api/changes');
    const changes = await request('/api/changes');
    console.log('Status:', changes.status);
    console.log('Proposals Count:', changes.body.length);

    // 3. Test Create Proposal
    console.log('\n3. POST /api/changes');
    const newProposal = await request('/api/changes', 'POST', {
      title: 'API Test Proposal',
      description: 'Created via API test script'
    });
    console.log('Status:', newProposal.status);
    console.log('New Proposal ID:', newProposal.body.id);

    console.log('\n✅ API Tests Completed!');
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
  }
}

// 等待服务器启动
setTimeout(runTests, 2000);

