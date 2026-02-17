# Cross-Review of SpecBmad V2 Final Architecture

> **评审日期**: 2026-02-01
> **评审者**: OpenAI Codex (gpt-5.2-codex)
> **Session ID**: 019c1bab-6c05-71b0-b708-73e8e6444e86
> **Tokens Used**: 17,234

---

## 1) Strengths — what's well designed

- **Scope reduction is real**: collapsing to 4 phases and 3 config files lowers cognitive load while preserving intent → design → build → review flow.

- **Quality gating as scores**: moving from binary pass/fail to weighted scoring is pragmatic for messy early-phase specs.

- **Agent abstraction layer**: the runtime interface + fallback strategy mitigates vendor SDK risk and allows offline/mocked paths.

- **Explicit boundary contracts**: per-agent scopes and tool allowlists are a solid foundation for safety and auditability.

- **Cost/complexity controls**: optional Semgrep/LLM enhancements acknowledge real-world constraints.

---

## 2) Weaknesses / Risks — what may bite you later

- **BoundaryGuard "fail-open" is a security foot-gun**: circuit breaker open skips checks entirely. A few failures can disable security for all tools.

- **Path checks are incomplete**: `preToolUse` only guards Write/Edit with `file_path`, but tools may use other params or read paths. A malicious/buggy tool can bypass.

- **Gate scoring semantics are underspecified**: no formal scale for check scores; rounding + threshold mismatch can hide borderline failures.

- **Traceability is fragile**: YAML mapping relies on human discipline; no strategy for keeping links in sync with code changes.

- **Non-blocking early gates = spec debt**: low-quality specs can propagate, with later stages blocked by unclear requirements.

- **"Graceful degradation" is only for external tools**: internal failures (config, schema, parser) have no stated fallback.

---

## 3) Missing Components — not addressed

- **Observability**: no metrics/logs schema, trace IDs, or dashboards for gate results, tool usage, failure rates.

- **Security & privacy**: no secrets management, PII handling, redaction, or audit log retention policy.

- **Concurrency & collaboration**: no lock/merge conflict strategy for `.specbmad/*.yaml`.

- **Spec/schema versioning**: no explicit schema version in `spec.yaml` or migration strategy beyond CLI mentions.

- **Prompting / model governance**: no standard prompts, temperature settings, determinism controls, or provenance for LLM outputs.

- **Exit criteria**: what does a "successful review" look like beyond scores? No acceptance baseline.

---

## 4) Over-Engineering — likely too complex

- **Circuit breaker in boundary guard**: sophisticated but risky; more complexity than benefit for a security boundary.

- **Weighted scoring + multiple check types**: powerful but could be premature without a rigorous scoring framework and data.

- **Multi-adapter runtime (SDK + direct + mock)**: good concept, but if only one provider is practical, this may be overkill early.

---

## 5) Alternative Approaches — potentially better options

- **Fail-closed boundary**: if checks fail or breaker trips, restrict tools to a minimal safe subset instead of full bypass.

- **Policy engine**: use a policy language (OPA/Rego or JSON schema + allowlists) for path/tool checks to reduce hand-rolled logic.

- **Traceability via annotations**: embed requirement IDs in code/tests with lint rules, then auto-build `trace.yaml` instead of manual mapping.

- **Gates as state machine**: use explicit states with remediation hints instead of a single aggregate score.

- **Schema-first config**: JSON Schema for `.specbmad` files with version field to make migrations safe and explicit.

---

## 6) Top 5 Specific Recommendations

1. **Make BoundaryGuard fail-closed** and add a *safe-mode* tool list when the breaker opens; never allow unrestricted tool use.

2. **Enforce path & tool checks for *all* tools**, and validate inputs against schemas; don't rely on `file_path` only.

3. **Add schema versioning** to `spec.yaml`/`trace.yaml` plus migration logic and validation errors that explain fixes.

4. **Automate traceability** with code/test annotations and a build step that generates `trace.yaml` to prevent drift.

5. **Define gate score semantics** (score ranges, severity mapping, rounding rules) and include remediation output per check.

---

## OpenAI Perspective (Constructive)

> The architecture is cleanly simplified and pragmatic, but security boundaries and traceability are under-specified and too permissive. The Claude-SDK-first runtime abstraction is smart, yet it should be vendor-neutral in practice. **Strengthen safety, clarify scoring, and automate traceability** before scaling the system.

---

## Claude vs Codex 评审对比

| 方面 | Claude (Architect Agent) | Codex (GPT-5.2) |
|------|--------------------------|-----------------|
| **核心关注** | 实施复杂度、SDK 依赖风险 | 安全边界、追溯自动化 |
| **最大风险** | Claude Agent SDK 不稳定 | Fail-open 是安全漏洞 |
| **建议重点** | 简化配置、可配置阈值 | Fail-closed、Schema 版本化 |
| **替代方案** | MCP 直接使用、ESLint 优先 | OPA 策略引擎、代码注解追溯 |

### 共识点

两个 AI 都同意：
1. ✅ 4-Phase 简化是正确的
2. ✅ Agent 抽象层是好设计
3. ✅ Gate 质量分数比二元更灵活
4. ⚠️ 追溯矩阵需要自动化
5. ⚠️ 需要更明确的 Schema 版本化

### 分歧点

| 话题 | Claude | Codex |
|------|--------|-------|
| 熔断器 | 需要，但加回退 | 过度工程，改为 fail-closed |
| 早期 Gate 非阻塞 | 允许推进 | 可能积累技术债 |
| 多适配器运行时 | 降低风险 | 可能过早优化 |
