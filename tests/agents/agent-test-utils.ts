import { AgentContext, AgentResult } from '@/types';

/**
 * Create a test agent context with custom input data
 */
export function createTestAgentContext(inputData?: Record<string, unknown>): AgentContext {
  return {
    projectState: {
      projectName: 'TestProject',
      stack: 'typescript',
      type: 'web',
      workflow: {
        currentStep: 'step1',
        completedSteps: ['step0']
      }
    },
    workingDirectory: process.cwd(),
    inputData: {
      ...inputData
    }
  };
}

/**
 * Assert that agent result has the expected AgentResult structure
 */
export function assertAgentResultValid(result: AgentResult): void {
  expect(result).toHaveProperty('success');
  expect(result).toHaveProperty('output');
  expect(result).toHaveProperty('artifacts');
  expect(result).toHaveProperty('nextSteps');
  expect(result).toHaveProperty('metadata');
  expect(result.metadata).toHaveProperty('agent');
  expect(Array.isArray(result.artifacts)).toBe(true);
  expect(Array.isArray(result.nextSteps)).toBe(true);
}

/**
 * Standard mock LLM response for agent testing
 */
export const MOCK_AGENT_RESPONSES: Record<string, string> = {
  'sprint planning': '## Sprint Goals\n- Goal 1\n- Goal 2\n\n## Next Steps\n- Create backlog\n- Assign tasks',
  'brief': '## Problem\nUser needs analysis\n\n## Next Steps\n- 建议进行详细分析\n- 行动计划制定',
  'comprehensive': '## Full Analysis\n1. Background\n2. Stakeholders\n\n## Next Steps\n- 建议深入调研',
  'brainstorm': '## Ideas\n- Idea 1\n- Idea 2\n- Idea 3\n\n## 建议\n- 进一步探索',
  'risk': '## Risks\n- Risk 1 (High)\n- Risk 2 (Medium)\n\n## 行动\n- Mitigate Risk 1',
  'research': '## Paper Analysis\n- Algorithm: X\n\n## Next Steps\n- Implement prototype',
  'standard': '## Security Analysis\n1. Overview\n2. Threats\n\n风险等级: medium\n\n## Next Steps\n- Fix vulnerabilities',
  'quick': '## Quick Findings\n- Issue 1\n- Issue 2\n\n风险等级: low',
  'compliance': '## Compliance\nGDPR: Pass\nISO 27001: Partial\n\n风险等级: high',
  'technical': '## Tech Stack\n- Node.js 18+\n- TypeScript\n\n## Next Steps\n- Set up project',
  'architecture': '## Architecture\n- Microservices\n\n## 任务\n- Design APIs',
  'business': '## Business Plan\n- KPI 1\n\n## 里程碑\n- Phase 1 complete',
  'resource': '## Team\n- 2 developers\n\n## Next Steps\n- Hire QA',
  'timeline': '## Timeline\n- Sprint 1: Foundation\n\n## 步骤\n- Setup CI/CD',
  'unit': '## Unit Test Strategy\n- Test functions\n\n## Next Steps\n- Write tests',
  'integration': '## Integration Plan\n- API contracts\n\n## 检查\n- Validate endpoints',
  'e2e': '## E2E Scenarios\n- Login flow\n\n## 行动\n- Set up Playwright',
  'security': '## Threat Model\n- XSS risk\n\n## Next Steps\n- Add sanitization',
  'performance': '## Profiling\n- Bundle size\n\n## 步骤\n- Optimize imports',
  'web': '## Implementation\n- React components\n\n## Next Steps\n- Implement UI',
  'backend': '## API Design\n- REST endpoints\n\n## Next Steps\n- Implement routes',
  'algorithm': '## Algorithm\n- O(n log n)\n\n## Next Steps\n- Write benchmarks',
  'implement': '## Code\n- Feature X\n\n## Next Steps\n- Implement core logic',
  'review': '## Review\n- Code quality\n\n## Next Steps\n- Refactor utils'
};
