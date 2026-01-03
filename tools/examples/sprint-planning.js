#!/usr/bin/env node
const { spawnSync } = require('child_process');

const result = spawnSync(process.execPath, ['dist/index.js', 'tasks'], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error('Failed to run sprint planning example:', result.error);
  process.exit(1);
}
process.exit(result.status ?? 0);