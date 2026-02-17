import { BaseLLMClient } from '../base';
import { LLMOptions, AgentType } from '@/types';

/**
 * 简易可控的 Mock LLM 客户端
 * - 无网络依赖，始终可用
 * - 基于提示关键字返回确定性 Markdown/JSON
 */
export class MockLLMClient extends BaseLLMClient {
  constructor(name: string = 'Mock', config?: { defaultModel?: string }) {
    super(name, AgentType.CUSTOM, { defaultModel: config?.defaultModel || 'mock-1' });
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async generateText(prompt: string, _options?: LLMOptions): Promise<string> {
    const p = prompt.toLowerCase();

    // 若提示要求严格 JSON，则返回固定结构 JSON
    if (p.includes('return strict json')) {
      return JSON.stringify(
        {
          goals: [
            '确保本迭代完成核心用户故事的拆解与估算',
            '提升研发效率并明确依赖关系'
          ],
          actions: [
            '创建任务列表并排期',
            '同步风险与阻塞项',
            '安排代码评审与集成'
          ],
          stories: [
            { id: 'S-101', title: '登录页面优化', priority: 'P1', estimate: '3d' },
            { id: 'S-102', title: '注册流程完善', priority: 'P2', estimate: '2d' }
          ],
          nextSteps: [
            '在看板新增任务并指派',
            '将依赖映射到相关团队'
          ]
        },
        null,
        2
      );
    }

    // 若提示要求结构化 Markdown，则返回固定 Markdown
    if (p.includes('return well-structured markdown')) {
      return [
        '# Sprint Planning Summary',
        '',
        '## Sprint Goals',
        '- 完成本迭代核心故事的拆解与估算',
        '- 明确依赖与风险缓解方案',
        '',
        '## Stories',
        '- S-101 登录页面优化 (P1, 3d)',
        '- S-102 注册流程完善 (P2, 2d)',
        '',
        '## Next Actions',
        '- 创建任务并排期',
        '- 协调跨团队依赖'
      ].join('\n');
    }

    // 默认返回简易文本，包含若干列表便于提取 next steps
    return [
      'Mocked response for agent instruction.',
      '- 创建任务列表并排期',
      '- 同步风险与阻塞项',
      '- 安排代码评审与集成'
    ].join('\n');
  }

  public async generateStructured<T>(prompt: string, schema: any, _options?: LLMOptions): Promise<T> {
    // 直接返回满足常见字段的对象；调用方可进行类型断言
    const payload: any = {
      goals: ['完成故事拆解', '明确依赖'],
      actions: ['创建任务', '安排评审'],
      stories: [
        { id: 'S-201', title: '重构认证模块', priority: 'P1', estimate: '4d' }
      ],
      nextSteps: ['更新看板']
    };

    // 若 schema 指定了特定顶层属性，则做最小适配
    if (schema && typeof schema === 'object') {
      for (const key of Object.keys(schema)) {
        if (payload[key] === undefined) {
          payload[key] = null;
        }
      }
    }

    return payload as T;
  }
}

export function createMockLLMClient(name: string = 'Mock'): MockLLMClient {
  return new MockLLMClient(name);
}