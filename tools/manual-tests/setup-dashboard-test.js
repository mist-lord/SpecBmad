const fs = require('fs');
const path = require('path');

// 模拟一个带有 Deltas 的变更提案
const setupTest = () => {
  const changesDir = path.join(process.cwd(), '.specbmad/changes'); // Fixed path
  const specsDir = path.join(process.cwd(), '.specbmad/specifications');
  
  // 1. 确保目录存在
  if (!fs.existsSync(changesDir)) fs.mkdirSync(changesDir, { recursive: true });
  if (!fs.existsSync(specsDir)) fs.mkdirSync(specsDir, { recursive: true });

  // 2. 创建一个基础规范文件 (用于测试修改功能)
  const specFile = path.join(specsDir, 'user-auth.md');
  const initialContent = `# User Authentication

## Overview
This module handles user login and registration.

## Requirements
### Login
User needs to provide email and password.
`;
  fs.writeFileSync(specFile, initialContent, 'utf-8');
  console.log('✅ Created base spec file: user-auth.md');

  // 3. 创建提案
  const proposalId = 'CP-TEST-WEB-01';
  const proposalDir = path.join(changesDir, proposalId);
  if (!fs.existsSync(proposalDir)) fs.mkdirSync(proposalDir, { recursive: true });

  const metadata = {
    id: proposalId,
    title: 'Web Dashboard Test Proposal',
    description: 'This proposal tests the Apply function from Web Dashboard with AST merging.',
    status: 'approved', // 直接设为 approved 以便测试 Apply
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const deltas = [
    {
      specPath: 'user-auth.md',
      changes: [
        {
          type: 'ADDED',
          requirement: 'OAuth Support',
          content: 'System must support Google and GitHub login.',
          scenarios: ['User clicks Google Login', 'System redirects to OAuth provider']
        },
        {
          type: 'MODIFIED',
          requirement: 'Login',
          content: 'User needs to provide email, password, and optionally a 2FA code.'
        }
      ]
    }
  ];

  fs.writeFileSync(path.join(proposalDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  fs.writeFileSync(path.join(proposalDir, 'deltas.json'), JSON.stringify(deltas, null, 2));
  
  console.log(`✅ Created test proposal: ${proposalId}`);
  console.log('👉 Now refresh your Web Dashboard (Changes page) and click "Apply" on this proposal.');
};

setupTest();

