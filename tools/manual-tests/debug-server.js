const { spawn } = require('child_process');
const http = require('http');

console.log('Starting server...');
const child = spawn('node', ['dist/index.js', 'ui', '--port', '3005'], {
  stdio: 'inherit' // 将输出直接打印到终端
});

setTimeout(() => {
  console.log('\nChecking connection...');
  const req = http.get('http://localhost:3005/api/status', (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.resume();
    child.kill();
    process.exit(0);
  }).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
    child.kill();
    process.exit(1);
  });
}, 3000);

