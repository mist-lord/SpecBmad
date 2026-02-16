# SpecBmad B2B 战略与架构演进规划

**生成日期**: 2026-02-08
**分析者**: Claude Sonnet 4.5 + Codex GPT-5.2
**项目状态**: v0.1.0 (90% 完成)
**版本**: v1.0

---

## 执行摘要

### Codex 核心建议

**B2B 战略：谨慎推荐 (65% 置信度)**

| 指标 | 评估结果 | 说明 |
|------|---------|------|
| **时间线调整** | 6-9 个月 (原计划 2-4 个月) | 企业销售周期更长 |
| **转化率调整** | 5-10% (原计划 10-20%) | 受监管行业决策周期长 |
| **预期价值** | +$365K EV | vs C2C -$89K EV |
| **关键风险** | 竞争定位、客户获取 | 需明确差异化 |

---

## 战略背景

### 原始项目定位

**SpecBmad v0.1.0** 是一个 AI 驱动的规格驱动开发框架：
- **核心价值**: Verification-First (验证优先)
- **差异化**: Traceability Matrix + Gate System + BoundaryGuard
- **目标市场**: 受监管行业 (医疗、金融、政府)
- **定价**: $99/用户/月 (Professional), 企业定制 (Enterprise)

### 当前功能完成度

| 模块 | 完成度 | 说明 |
|------|--------|------|
| 4-Phase MVP | 90% | Phase 0-3 已实现 |
| Gate System | 75% | 4 个门禁，Phase 4 待完善 |
| Multi-Agent | 85% | 6 个 Agent，Security Expert 待完善 |
| BoundaryGuard | 80% | Fail-Closed 安全系统基本可用 |
| Traceability | 70% | @traces 注解支持，待测试验证 |
| MCP 集成 | 0% | **未开始，P0 阻塞项** |

---

## B2B 战略确认

### 4 个关键问题及答案

#### 问题 1: 如何获取前 10 个付费客户？

**策略**: 行业聚焦 + 案例驱动

| 阶段 | 时间 | 策略 | 目标 |
|------|------|------|------|
| **Month 1-2** | Week 1-4 | 医疗行业 Hackathon | 5 个试用客户 |
| **Month 2-3** | Week 5-8 | 医疗案例研究发布 | 2 个付费客户 |
| **Month 3-6** | Week 9-24 | 金融行业拓展 | 5 个付费客户 |
| **Month 6-9** | Week 25-36 | 渠道合作 (AWS Marketplace) | 10+ 付费客户 |

**关键动作**:
1. **医疗垂直**: 聚焦 FDA 510(k) 认证需求，发布 "AI-Driven 合规开发" 白皮书
2. **金融垂直**: 聚焦 SOX 审计需求，发布 "代码审计追溯" 案例研究
3. **政府垂直**: 聚焦 CMMI 认证需求，通过合作伙伴获取订单

#### 问题 2: 如何在竞争中存活？

**生存策略**: 差异化 + 生态位

| 竞争对手 | 定位 | SpecBmad 差异化 |
|---------|------|----------------|
| **Cursor** | C2C + 速度 | B2B + 验证 (不竞争) |
| **Copilot** | 通用辅助 | 专业合规 (不竞争) |
| **Kiro (AWS)** | 闭源云服务 | 开源 + 本地部署 (差异化) |
| **Goose** | C2C + 简洁 | B2B + 复杂验证 (不竞争) |

**生态位**: "受监管行业的 AI 代码审计工具"

**生存公式**:
```
SpecBmad = 开源 + 验证层 + 本地部署 + 受监管行业
         = 无直接竞争对手
```

#### 问题 3: 如何证明产品价值？

**价值证明框架**

| 阶段 | 证据类型 | 具体内容 |
|------|---------|---------|
| **试用阶段** | 效率提升 | 30% 开发时间缩短 |
| **试用阶段** | 质量提升 | 50% Bug 减少 |
| **付费阶段** | 合规通过 | FDA 510(k) 案例 |
| **付费阶段** | 审计追溯 | SOX 合规案例 |

**MVP 验证指标**:
- 📊 效率提升 ≥ 20%
- 📊 Bug 密度 ≤ 行业平均 50%
- 📊 验证通过率 ≥ 95%
- 📊 客户满意度 ≥ 4.5/5

#### 问题 4: 开源如何盈利？

**Open Core 商业模式**

| 层 | 内容 | 价格 | 目标用户 |
|----|------|------|---------|
| **Free** | 核心 CLI + 基础模板 | $0 | 个人开发者、创业公司 |
| **Professional** | 完整 Gate System + 报告 | $99/月 | 中小企业 |
| **Enterprise** | 本地部署 + 定制 + 支持 | $50K+/年 | 大型企业、受监管行业 |

**开源 → 付费转化路径**:

```
Step 1: GitHub Stars 增长 (病毒式传播)
   ↓
Step 2: 试用 Professional (14天免费)
   ↓
Step 3: 触发 Gate 失败，提示 "升级 Pro 解锁高级验证"
   ↓
Step 4: 企业需要本地部署 → Enterprise 销售
```

**关键指标**:
- 开源用户 → 付费转化: 2-5%
- Professional → Enterprise 升级: 10-20%
- Enterprise ACV: $50K-$200K/年

---

## Codex B2B 战略评估

### 评估结果 (65% 置信度)

#### ✅ 支持点

1. **差异化有效**
   - 受监管行业确实需要验证层
   - 开源 + 本地部署 + 验证 = 独特组合
   - Cursor/Copilot 不做 B2B 合规

2. **成本结构合理**
   - $50K-$200K/年定价可行
   - 企业愿意为合规付费
   - 客户获取成本 (CAC) 可控

3. **技术可行**
   - 90% 功能已完成
   - MCP 集成是 P0 但可行
   - 4-6 个月可达生产就绪

#### ⚠️ 风险点

1. **时间线过于乐观**
   ```
   原计划: 2-4 个月 → 首个企业客户
   现实:   6-9 个月 → 首个企业客户
   
   原因:
   - 受监管行业决策周期: 3-6 个月
   - POC 验证周期: 2-3 个月
   - 合同签订周期: 1-2 个月
   ```

2. **转化率过于乐观**
   ```
   原计划: 10-20% 试用 → 付费
   现实:   5-10% 试用 → 付费
   
   原因:
   - 受监管行业试用意愿低
   - 需要完整 POC 才能决策
   - 竞争方案多 (合规咨询公司)
   ```

3. **竞争定位模糊**
   - "验证层" 价值主张不够具体
   - 需要更清晰的用例 (Use Case)
   - 医疗/金融/政府的优先级待定

### 调整后的 B2B 战略

| 维度 | 原计划 | 调整后 | 原因 |
|------|--------|--------|------|
| **时间线** | 2-4 个月首个客户 | 6-9 个月首个客户 | 企业销售周期 |
| **转化率** | 10-20% | 5-10% | 受监管行业保守 |
| **目标客户数** | Year 1: 5 个企业 | Year 1: 3-5 个企业 | 聚焦质量 |
| **定价** | $50K/年 起 | $50K-$100K/年 | 降低入门门槛 |

---

## 架构演进路线图

### 当前架构 (v0.1.0)

```
┌─────────────────────────────────────────────────────────────┐
│                      Unified CLI                             │
│                    (go, change, ui)                          │
├─────────────────────────────────────────────────────────────┤
│                    Workflow Orchestrator                      │
│                    (4-Phase State Machine)                   │
├──────────────────────┬──────────────────────────────────────┤
│                      │         Agent Team                     │
│     Context          │  Analyst → Architect → Developer      │
│     Manager          │       → QA → Security → Scrum         │
│                      │              ↓                         │
│                      │         LLM Manager                   │
├──────────────────────┴──────────────────────────────────────┤
│                      Core Engine                             │
│  (LLM, Phase, Spec, Workflow, Verification, Boundary, ...)   │
├──────────────────────┬──────────────────────────────────────┤
│                      │              Plugin Layer              │
│    Event Store       │  stack-typescript / stack-python      │
│    (Audit Log)       │  / stack-cpp                          │
└──────────────────────┴──────────────────────────────────────┘
```

### 演进目标架构 (v1.0.0)

```
┌─────────────────────────────────────────────────────────────┐
│                    SaaS Control Plane                        │
│  (Dashboard, Analytics, Billing, Multi-tenant Auth)          │
├─────────────────────────────────────────────────────────────┤
│                   API Gateway (REST/gRPC)                    │
├──────────────────────┬──────────────────────────────────────┤
│                      │         Enterprise Services            │
│     Web UI           │  • Compliance Reports                 │
│     (React)          │  • Audit Dashboard                    │
│                      │  • Team Management                    │
├──────────────────────┴──────────────────────────────────────┤
│                    B2B Services Layer                        │
│  (Multi-tenant, RBAC, Usage Tracking, Billing)               │
├──────────────────────┬──────────────────────────────────────┤
│                      │         Agent Team (Enhanced)          │
│     MCP Server       │  Analyst → Architect → Developer      │
│     (External)       │  → QA → Security → Scrum → DevOps     │
│                      │              ↓                         │
│                      │         LLM Manager (Multi-Provider)  │
├──────────────────────┴──────────────────────────────────────┤
│                      Core Engine (v1.0)                       │
│  (LLM, Phase, Spec, Workflow, Verification, Boundary, ...)   │
├──────────────────────┬──────────────────────────────────────┤
│                      │              Plugin Layer              │
│    Event Store       │  stack-typescript / stack-python      │
│    (PostgreSQL)      │  / stack-cpp + Custom Plugins         │
└──────────────────────┴──────────────────────────────────────┘
```

### 演进阶段

#### Phase 1: v0.2.0 - MCP Foundation (Month 1-2)

**目标**: 实现 MCP Server 集成，使 SpecBmad 可被 Cursor/Claude Desktop 调用

```
packages/
└── @specbmad/
    └── mcp-gate/                    🆕 MCP Server Package
        ├── src/
        │   ├── server.ts            # MCP Server 主入口
        │   ├── tools/
        │   │   ├── verify_code.ts   # 验证代码
        │   │   ├── check_gate.ts    # 检查门禁
        │   │   └── trace_requirement.ts  # 追溯需求
        │   ├── resources/
        │   │   ├── spec.ts          # 规格资源
        │   │   └── state.ts         # 状态资源
        │   └── prompts/
        │       └── verification.ts  # 验证提示
        ├── package.json
        └── tsconfig.json
```

**核心工具**:
| Tool | 输入 | 输出 | 用途 |
|------|------|------|------|
| `verify_code` | code, spec_id | pass/fail + issues | 验证代码符合规格 |
| `check_gate` | gate_id, phase | gate_status | 检查门禁状态 |
| `trace_requirement` | requirement_id | trace_report | 生成追溯报告 |
| `get_spec` | spec_id | spec_content | 获取规格文档 |

**时间投入**: ~64 小时 (P0)

#### Phase 2: v0.3.0 - Community Validation (Month 3-4)

**目标**: 开源发布，收集社区反馈，验证产品价值

| 任务 | 内容 | 时间 |
|------|------|------|
| 开源准备 | 代码清理、文档完善、CI/CD | 20h |
| 发布策略 | GitHub Release、HackerNews、Twitter | 10h |
| 社区运营 | Discord/论坛、Issue 响应 | 40h |
| 反馈收集 | 用户访谈、需求整理 | 20h |

**时间投入**: ~90 小时 (P1)

**验证指标**:
- ⭐ GitHub Stars: 500+
- 👥 Discord 成员: 200+
- 🐛 Issue 数: 50+
- 💬 PR 数: 10+

#### Phase 3: v0.5.0 - Enterprise Features (Month 5-8)

**目标**: 企业级功能，多租户支持，合规报告

```
packages/
└── @specbmad/
    ├── mcp-gate/           # v0.2.0
    └── enterprise/         🆕 Enterprise Package
        ├── src/
        │   ├── multi_tenant/     # 多租户支持
        │   │   ├── tenant_id.ts  # 租户标识
        │   │   └── schema.ts     # 租户模式
        │   ├── rbac/             # RBAC 权限
        │   │   ├── roles.ts      # 角色定义
        │   │   └── permissions.ts # 权限检查
        │   ├── compliance/       # 合规报告
        │   │   ├── reports.ts    # 报告生成
        │   │   └── audit.ts      # 审计日志
        │   └── billing/          # 计费系统
        │       ├── usage.ts      # 用量统计
        │       └── invoices.ts   # 发票生成
        └── package.json
```

**企业功能**:
| 功能 | 描述 | 优先级 |
|------|------|--------|
| 多租户 | 租户隔离 + 共享数据库 | P0 |
| RBAC | 角色权限控制 (Admin/Reviewer/Dev) | P0 |
| 合规报告 | FDA 510(k)、SOX、CMMI 报告 | P1 |
| SSO/SAML | 企业单点登录 | P1 |
| 审计日志 | 完整的操作追溯 | P0 |

**数据库模式** (PostgreSQL):
```sql
-- 多租户模式
CREATE TABLE specbmad.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) NOT NULL DEFAULT 'professional',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 租户隔离
CREATE TABLE specbmad.specifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES specbmad.tenants(id),
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW()
);

-- RLS 策略
ALTER TABLE specbmad.specifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON specbmad.specifications
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

**时间投入**: ~140 小时 (P2)

#### Phase 4: v1.0.0 - SaaS Platform (Month 9-12)

**目标**: 生产级 SaaS，自动化运维，自动扩缩容

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS Infrastructure                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  CloudFront │  │    ALB      │  │  ECS Fargate        │  │
│  │   (CDN)     │  │   (HTTPS)   │  │  (API Containers)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                          ↓                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │    Elasti   │  │   RDS       │  │  ElastiCache        │  │
│  │  Cache      │  │ PostgreSQL  │  │  (Redis)            │  │
│  │  (Session)  │  │  (Primary)  │  │  (Cache)            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**SaaS 功能**:
| 功能 | 描述 | 技术 |
|------|------|------|
| 自动扩缩容 | ECS Fargate 自动伸缩 | AWS Auto Scaling |
| 全球 CDN | 静态资源分发 | CloudFront |
| 监控告警 | 7x24 监控 | CloudWatch + PagerDuty |
| 备份恢复 | 自动备份 + 恢复 | RDS Snapshots |
| DDoS 防护 | WAF 规则 | AWS WAF |

**ACME 证书**: 支持 HTTPS 自动续期

**时间投入**: ~200 小时 (P3)

---

## 实现优先级

### P0 - 必须完成 (Month 1-2)

| 任务 | 时间 | 依赖 | 负责人 |
|------|------|------|--------|
| MCP Server 实现 | 40h | 无 | Claude |
| Cursor 集成测试 | 8h | MCP Server | Claude |
| 文档完善 | 16h | MCP Server | Claude |

### P1 - 应该完成 (Month 3-4)

| 任务 | 时间 | 依赖 | 负责人 |
|------|------|------|--------|
| 开源发布 | 20h | MCP Server | Claude |
| 社区运营 | 40h | 开源发布 | Claude |
| 用户反馈收集 | 20h | 社区运营 | Claude |

### P2 - 最好完成 (Month 5-8)

| 任务 | 时间 | 依赖 | 负责人 |
|------|------|------|--------|
| 多租户支持 | 60h | P0 | Claude |
| RBAC 权限 | 40h | 多租户 | Claude |
| 合规报告 | 40h | P0 | Claude |

### P3 - 后期规划 (Month 9-12)

| 任务 | 时间 | 依赖 | 负责人 |
|------|------|------|--------|
| SaaS 基础设施 | 100h | P2 | Claude |
| 监控运维 | 60h | SaaS | Claude |
| 全球化支持 | 40h | SaaS | Claude |

---

## 风险与缓解

### 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| MCP SDK 不稳定 | 中 | 中 | 隔离 SDK，保留替换能力 |
| LLM API 成本过高 | 高 | 高 | 实施缓存 + 降级策略 |
| 性能瓶颈 | 中 | 中 | 性能测试 + 优化 |

### 市场风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 受监管行业不接受 AI | 中 | 高 | 案例驱动 + ROI 证明 |
| 竞争对手跟进 | 高 | 低 | 先发优势 + 生态锁定 |
| 监管政策变化 | 低 | 高 | 合规咨询 + 政策跟踪 |

### 运营风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 首个客户获取困难 | 高 | 高 | 聚焦 + 优惠 + 案例 |
| 开源社区不活跃 | 中 | 中 | 持续投入 + 社区运营 |
| 团队资源不足 | 高 | 高 | 自动化 + 外包非核心 |

---

## 成功指标

### Month 2 (v0.2.0)

- [ ] MCP Server 发布到 npm
- [ ] Cursor 集成测试通过
- [ ] 文档完整度 ≥ 80%

### Month 4 (v0.3.0)

- [ ] GitHub Stars ≥ 500
- [ ] 社区反馈 ≥ 50 条
- [ ] 产品改进 ≥ 10 项

### Month 8 (v0.5.0)

- [ ] 首个付费企业客户
- [ ] 多租户功能完整
- [ ] 合规报告可用

### Month 12 (v1.0.0)

- [ ] ARR ≥ $100K
- [ ] 付费客户 ≥ 5
- [ ] SaaS 可用性 ≥ 99.9%

---

## 总结

### 核心结论

1. **B2B 战略确认**: 65% 置信度，建议接受
   - 差异化有效，但需聚焦受监管行业
   - 时间线调整: 6-9 个月首个客户
   - 转化率调整: 5-10%

2. **架构演进清晰**: 4 个版本，12 个月完成
   - v0.2.0: MCP 集成 (P0)
   - v0.3.0: 开源验证
   - v0.5.0: 企业功能
   - v1.0.0: SaaS 平台

3. **执行重点**: MCP Server 是 P0 阻塞项
   - 必须 Month 1-2 完成
   - 是后续所有工作的基础

### 一句话建议

> **聚焦受监管行业，快速完成 MCP 集成，用案例驱动销售，接受 6-9 个月销售周期，6 个月后评估调整。**

---

## 附录

### 相关文档

- [AI 趋势分析与转型战略](./AI_TRENDS_2026_SPECBMAD_TRANSFORMATION_REVIEW.md)
- [C2C vs B2B 战略决策](./C2C_VS_B2B_STRATEGIC_DECISION.md)
- [ADR-004: Boundary-Driven Architecture](./adr/ADR-ARCH-004-boundary-driven-architecture.md)
- [当前架构设计](./ARCHITECTURE.md)
- [重构计划](./REFACTORING_PLAN.md)

### 技术参考

- [MCP SDK](https://github.com/modelcontextprotocol/sdk)
- [Anthropic Claude](https://www.anthropic.com/claude)
- [OpenAI Codex](https://developers.openai.com/codex)

---

**文档生成**: 2026-02-08
**下次评审**: Month 2 (v0.2.0 发布后)
