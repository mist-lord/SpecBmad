import { AgentContext, AgentResult } from '@/types';
import { AgentFactory } from '@/agents/factory';
import { llmManager } from '@/core/llm/manager';
import { log } from '@/utils/logger';
import { registerBuiltInAgents } from '@/agents';
import { config } from '@/utils/config';
import { PATHS, getProjectPath } from '@/utils/paths';
import fs from 'fs';
import { PerformanceObserver } from 'perf_hooks';
import { PhaseController } from '@/core/phase/controller';
import { EventStore } from '@/core/events/store';
import { PhaseContext, PhaseNumber } from '@/core/phase/types';
import { registerDefaultGates } from '@/core/phase/gates';
import { specKit } from '@/core/spec/spec-kit';

export interface WorkflowStepConfig {
  id: string;
  name: string;
  agent: string; // AgentFactory key, e.g., 'ScrumMaster', 'Developer', 'QA'
  input?: Record<string, any>;
  dependencies?: string[];
}

export interface WorkflowDefinition {
  name: string;
  description?: string;
  steps: WorkflowStepConfig[];
}

export class Orchestrator {
  // 资源采样状态
  private gcCount: number = 0;
  private gcDurationMs: number = 0;
  private gcKinds: Record<string, number> = {};
  private perfObserver: PerformanceObserver | null = null;

  constructor() {
    try {
      this.perfObserver = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          const anyE: any = e as any;
          const entryType = anyE.entryType || anyE.name;
          if (entryType === 'gc') {
            this.gcCount++;
            const dur = (anyE.duration as number) || 0;
            this.gcDurationMs += dur;
            const kindVal = anyE.kind;
            const kindMap: Record<number, string> = { 0: 'unknown', 1: 'minor', 2: 'major', 3: 'incremental', 4: 'weakcb' };
            const kind = typeof kindVal === 'number' ? (kindMap[kindVal] || 'unknown') : String(kindVal || 'unknown');
            this.gcKinds[kind] = (this.gcKinds[kind] || 0) + 1;
          }
        }
      });
      this.perfObserver.observe({ entryTypes: ['gc'], buffered: true });
    } catch {
      // perf_hooks 或 gc entries 不可用时忽略
    }
  }

  async executeWorkflow(workflowName: string, initialContext: AgentContext, defaultFormat: string = 'json'): Promise<AgentResult[]> {
    const definition = this.getWorkflowDefinition(workflowName);
    const results: AgentResult[] = [];

    if (!definition.steps || definition.steps.length === 0) {
      throw new Error(`工作流未定义或为空: ${workflowName}`);
    }

    // Ensure LLM manager ready
    await llmManager.initialize();
    const client = llmManager.getDefaultClient();
    if (!client) {
      throw new Error('未找到可用的默认 LLM 客户端');
    }

    // 注册所有内置代理，避免未注册导致工作流失败
    registerBuiltInAgents();

    let context = { ...initialContext } as AgentContext;

    // 解析依赖并生成执行顺序
    const orderedSteps = this.resolveExecutionOrder(definition.steps);
    // 从初始上下文加载已完成步骤以支持恢复
    const initialCompleted = context.projectState?.workflow?.completedSteps || [];
    const completedSet = new Set<string>(initialCompleted);

    for (const step of orderedSteps) {
      log.info(`执行工作流步骤: ${step.name} (${step.id}) -> 代理: ${step.agent}`);

      // 如果该步骤已在完成集合中，则跳过（恢复模式）
      if (completedSet.has(step.id)) {
        log.info(`检测到已完成步骤，跳过: ${step.id}`);
        continue;
      }

      // Update context workflow state BEFORE execution (current step only)
      context = {
        ...context,
        projectState: {
          ...context.projectState,
          workflow: {
            currentStep: step.id,
            completedSteps: Array.from(completedSet)
          }
        },
        inputData: {
          ...(context.inputData || {}),
          ...(step.input || {}),
          format: (step.input?.format as string) || defaultFormat
        }
      };

      try {
        const agent = AgentFactory.create(step.agent, client);
        const result = await this.executeWithRetry(agent, context, step);
        results.push(result);

        // 成功后更新完成集与持久化状态
        completedSet.add(step.id);
        this.persistWorkflowState(workflowName, step.id, Array.from(completedSet), 'running', undefined, this.sampleResources('persist', step.id));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log.error(`步骤失败: ${step.id} / 代理 ${step.agent}: ${msg}`);
        // 失败时也持久化当前状态，便于恢复
        this.persistWorkflowState(workflowName, step.id, Array.from(completedSet), 'failed', msg, this.sampleResources('persist', step.id));
        throw e;
      }
    }

    // 全部完成后更新最终状态
    const last = Array.from(completedSet).slice(-1)[0] || '';
    this.persistWorkflowState(workflowName, last, Array.from(completedSet), 'completed', undefined, this.sampleResources('persist', last || 'final'));

    return results;
  }

  /**
   * 4-Phase MVP: Phase 驱动的工作流执行
   *
   * Phase 0: Capture (需求捕获)
   * Phase 1: Design (架构设计)
   * Phase 2: Build (实现)
   * Phase 3: Review (验收)
   */
  async executePhaseWorkflow(initialContext: AgentContext, startPhase: PhaseNumber = 0, endPhase: PhaseNumber = 3): Promise<AgentResult[]> {
    // 注册默认 Gate 检查器
    await registerDefaultGates();

    const controller = new PhaseController();
    const eventStore = new EventStore();
    const results: AgentResult[] = [];

    log.info(`开始 4-Phase MVP 工作流: Phase ${startPhase} → ${endPhase}`);

    // 确保 LLM manager 就绪
    await llmManager.initialize();
    const client = llmManager.getDefaultClient();
    if (!client) {
      throw new Error('未找到可用的默认 LLM 客户端');
    }

    // 注册所有内置代理
    registerBuiltInAgents();

    const currentPhase = controller.getCurrentPhase();
    if (currentPhase < startPhase) {
      log.warn(`当前 Phase ${currentPhase} 小于起始 Phase ${startPhase}，重置为 ${startPhase}`);
    }

    // 执行 Phase 0→3 流程
    for (let phase = Math.max(currentPhase, startPhase); phase <= endPhase; phase++) {
      log.info(`执行 Phase ${phase}`);

      const phaseContext: PhaseContext = {
        projectRoot: process.cwd(),
        currentPhase: phase as PhaseNumber,
        metadata: {
          workflow: '4-phase-mvp',
          startPhase,
          endPhase
        }
      };

      let phaseResult: AgentResult | null = null;

      try {
        switch (phase) {
          case 0: {
            // Phase 0: Capture (需求捕获)
            log.info('Phase 0: Capture - 需求捕获');
            if (initialContext.inputData?.requirement) {
              const specKitResult = await specKit.execute({
                input: initialContext.inputData.requirement as string
              });
              if (!specKitResult.success) {
                throw new Error(`需求捕获失败: ${specKitResult.error}`);
              }
              phaseResult = {
                success: true,
                output: `需求已捕获: ${specKitResult.outputPath}`,
                artifacts: [specKitResult.outputPath],
                nextSteps: ['进入架构设计阶段'],
                metadata: { phase: 0, specKitResult }
              };
            } else {
              // 如果没有 requirement，使用 Analyst Agent 分析
              const analyst = AgentFactory.create('Analyst', client);
              phaseResult = await analyst.execute(initialContext);
            }
            break;
          }

          case 1: {
            // Phase 1: Design (架构设计)
            log.info('Phase 1: Design - 架构设计');
            const architect = AgentFactory.create('Architect', client);
            const architectContext: AgentContext = {
              ...initialContext,
              inputData: {
                ...initialContext.inputData,
                type: 'technical'
              }
            };
            phaseResult = await architect.execute(architectContext);
            break;
          }

          case 2: {
            // Phase 2: Build (实现)
            log.info('Phase 2: Build - 代码实现');
            const developer = AgentFactory.create('Developer', client);
            const devContext: AgentContext = {
              ...initialContext,
              inputData: {
                ...initialContext.inputData,
                task: 'core-feature'
              }
            };
            phaseResult = await developer.execute(devContext);
            break;
          }

          case 3: {
            // Phase 3: Review (验收)
            log.info('Phase 3: Review - QA 验收');
            const qa = AgentFactory.create('QA', client);
            const qaContext: AgentContext = {
              ...initialContext,
              inputData: {
                ...initialContext.inputData,
                type: 'integration'
              }
            };
            phaseResult = await qa.execute(qaContext);
            break;
          }
        }

        if (phaseResult) {
          results.push(phaseResult);
        }

        // 尝试迁移到下一个 Phase
        if (phase < endPhase) {
          const nextPhase = (phase + 1) as PhaseNumber;
          const transitionResult = await controller.transitionTo(nextPhase, phaseContext);

          eventStore.appendEvent({
            type: 'phase_transition',
            phase: nextPhase,
            status: transitionResult.success ? 'passed' : 'failed',
            timestamp: transitionResult.timestamp,
            actor: 'orchestrator',
            inputs: { fromPhase: phase, toPhase: nextPhase },
            outputs: { gateResults: transitionResult.gateResults },
            notes: transitionResult.error
          });

          if (!transitionResult.success) {
            throw new Error(`Phase 迁移失败: ${transitionResult.error}`);
          }

          log.success(`Phase 迁移成功: ${phase} → ${nextPhase}`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.error(`Phase ${phase} 执行失败: ${msg}`);

        eventStore.appendEvent({
          type: 'error',
          phase,
          timestamp: new Date().toISOString(),
          error: msg,
          context: { phase, startPhase, endPhase }
        });

        throw error;
      }
    }

    log.success(`4-Phase MVP 工作流完成: Phase ${startPhase} → ${endPhase}`);
    return results;
  }

  // 根据依赖关系生成拓扑序；无依赖则按原序
  private resolveExecutionOrder(steps: WorkflowStepConfig[]): WorkflowStepConfig[] {
    const byId = new Map<string, WorkflowStepConfig>();
    for (const s of steps) byId.set(s.id, s);

    const resolved: WorkflowStepConfig[] = [];
    const completed = new Set<string>();
    const pending = new Set<string>(steps.map((s) => s.id));

    let safety = 0;
    while (pending.size > 0) {
      if (++safety > steps.length * 2) {
        throw new Error('检测到工作流步骤依赖循环或无法解析的依赖');
      }

      let progressed = false;
      for (const id of Array.from(pending)) {
        const s = byId.get(id)!;
        const deps = s.dependencies || [];
        const ready = deps.every((d) => completed.has(d));
        if (ready) {
          resolved.push(s);
          completed.add(id);
          pending.delete(id);
          progressed = true;
        }
      }

      if (!progressed) {
        // 若无任何进展，尝试按原顺序插入剩余项（无效依赖名将导致错误）
        for (const id of Array.from(pending)) {
          const s = byId.get(id)!;
          const deps = s.dependencies || [];
          // 如果依赖不存在于步骤列表，抛错
          for (const d of deps) {
            if (!byId.has(d)) {
              throw new Error(`步骤 ${s.id} 的依赖不存在: ${d}`);
            }
          }
        }
        throw new Error('工作流依赖无法满足，可能存在循环依赖');
      }
    }

    return resolved.length ? resolved : steps;
  }

  private async executeWithRetry(agent: any, context: AgentContext, step: WorkflowStepConfig): Promise<AgentResult> {
    const retries = typeof step.input?.retries === 'number' ? step.input!.retries! : 0;
    const backoffMs = typeof step.input?.retryDelayMs === 'number' ? step.input!.retryDelayMs! : 250;

    let attempt = 0;
    for (attempt = 0; attempt <= retries; attempt++) {
      try {
        return await agent.execute(context);
      } catch (err) {
        if (attempt === retries) throw err;
        const nextAttempt = attempt + 1;
        log.warn(`步骤 ${step.id} 失败，重试 ${nextAttempt}/${retries}，原因: ${err instanceof Error ? err.message : String(err)}`);
        await this.delay(backoffMs * nextAttempt);
      }
    }
    // 正常情况下不会到达这里；为满足类型检查返回一个拒绝
    throw new Error('Retry loop exhausted');

  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private persistWorkflowState(
    workflowName: string,
    currentStep: string,
    completedSteps: string[],
    status: 'running' | 'failed' | 'completed' = 'running',
    lastError?: string,
    resourceSample?: any
  ): void {
    try {
      const dir = getProjectPath(PATHS.CONFIG_DIR);
      const file = getProjectPath(PATHS.WORKFLOW_STATE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      let existing: any = {};
      if (fs.existsSync(file)) {
        try { existing = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { existing = {}; }
      }
      const samples: any[] = Array.isArray(existing.resourceSamples) ? existing.resourceSamples : [];
      if (resourceSample) samples.push(resourceSample);
      const payload = {
        workflow: workflowName,
        currentStep,
        completedSteps,
        status,
        lastError,
        updatedAt: new Date().toISOString(),
        resourceSamples: samples
      };
      fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (e) {
      log.debug(`持久化工作流状态失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private sampleResources(phase: 'before' | 'after' | 'persist', stepId: string) {
    const mu = process.memoryUsage();
    const cu = process.cpuUsage();
    return {
      ts: new Date().toISOString(),
      phase,
      stepId,
      memory: {
        rss: mu.rss,
        heapTotal: mu.heapTotal,
        heapUsed: mu.heapUsed,
        external: (mu as any).external || 0,
        arrayBuffers: (mu as any).arrayBuffers || 0
      },
      cpu: { user: cu.user, system: cu.system },
      gc: { count: this.gcCount, totalDurationMs: this.gcDurationMs, kinds: this.gcKinds }
    };
  }

  /**
   * 获取工作流定义
   *
   * 4-Phase MVP 简化：只保留核心工作流
   */
  getWorkflowDefinition(name: string): WorkflowDefinition {
    // 优先从配置读取扩展定义
    try {
      const cfg = config.getAll();
      const custom = cfg.workflows?.[name];
      if (custom && Array.isArray(custom.steps) && custom.steps.length > 0) {
        return { name, description: custom.description, steps: custom.steps };
      }
    } catch {
      // 配置不可用时忽略
    }

    // 4-Phase MVP 核心工作流
    switch (name) {
      case 'default':
      case 'full-development':
        // 完整 4-Phase 流程
        return {
          name,
          description: '完整开发流程 (Capture → Design → Build → Review)',
          steps: [
            { id: 'capture', name: 'Capture', agent: 'Analyst', input: { mode: 'brief' } },
            { id: 'design', name: 'Design', agent: 'Architect', input: { type: 'technical' } },
            { id: 'build', name: 'Build', agent: 'Developer', input: { mode: 'feature' } },
            { id: 'review', name: 'Review', agent: 'QA', input: { type: 'integration' } }
          ]
        };

      case 'quick':
        // 快速流程（跳过 Review）
        return {
          name,
          description: '快速开发流程 (Capture → Design → Build)',
          steps: [
            { id: 'capture', name: 'Capture', agent: 'Analyst', input: { mode: 'brief' } },
            { id: 'design', name: 'Design', agent: 'Architect', input: { type: 'technical' } },
            { id: 'build', name: 'Build', agent: 'Developer', input: { mode: 'feature' } }
          ]
        };

      case 'design-only':
        // 仅设计（Capture → Design）
        return {
          name,
          description: '仅设计流程 (Capture → Design)',
          steps: [
            { id: 'capture', name: 'Capture', agent: 'Analyst', input: { mode: 'brief' } },
            { id: 'design', name: 'Design', agent: 'Architect', input: { type: 'technical' } }
          ]
        };

      default:
        return { name, steps: [] };
    }
  }
}
