import { registerScrumMasterAgent } from '@/agents/scrum-master';
import { registerDeveloperAgent } from '@/agents/developer';
import { registerQAAgent } from '@/agents/qa';
import { registerAnalystAgent } from '@/agents/analyst';
import { registerArchitectAgent } from '@/agents/architect';
import { AgentFactory } from '@/agents/factory';
import { ScrumMasterAgent } from '@/agents/scrum-master';
import { AnalystAgent } from '@/agents/analyst';
import { DeveloperAgent } from '@/agents/developer';
import { ArchitectAgent } from '@/agents/architect';
import { QAAgent } from '@/agents/qa';

// 注册所有内置代理；若已注册则跳过
export function registerBuiltInAgents(): void {
  registerScrumMasterAgent();
  registerDeveloperAgent();
  registerQAAgent();
  registerAnalystAgent();
  registerArchitectAgent();

  if (!AgentFactory.has('PM')) AgentFactory.register('PM', AnalystAgent as any);
  if (!AgentFactory.has('BusinessAnalyst')) AgentFactory.register('BusinessAnalyst', AnalystAgent as any);
  if (!AgentFactory.has('TEA')) AgentFactory.register('TEA', QAAgent as any);
  if (!AgentFactory.has('UX')) AgentFactory.register('UX', AnalystAgent as any);
  if (!AgentFactory.has('GameDesigner')) AgentFactory.register('GameDesigner', AnalystAgent as any);
  if (!AgentFactory.has('GameDeveloper')) AgentFactory.register('GameDeveloper', DeveloperAgent as any);
  if (!AgentFactory.has('GameArchitect')) AgentFactory.register('GameArchitect', ArchitectAgent as any);
}
