#!/bin/bash

# 创建临时目录存放源码
mkdir -p ./diagrams_src
mkdir -p ./output_images

# 1. 核心系统架构图
cat <<EOF > ./diagrams_src/1_architecture.mmd
graph TD
    U[用户] --> C[CLI入口: dist/index.js]
    C -->|解析命令| CMD[具体命令: analyze/plan/implement/qa/workflow]
    CMD -->|加载配置| CFG[项目配置: .specbmad/config.json]
    CMD -->|初始化| LM[LLMManager]
    LM -->|注册默认/Mock客户端| LLM[(LLM Client)]
    CMD -->|编排执行| ORC[Orchestrator]
    ORC -->|注册内置代理| AF[AgentFactory]
    AF -->|实例化| AG[具体Agent: ScrumMaster/Developer/QA]
    AG -->|生成响应| LLM
    AG -->|写产物/更新内存| ART[产物/摘要]
    ORC -->|持久化| STATE[.bmad/workflow.state.json]
    CMD -->|输出| OUT["控制台/文件(.bmad/*.md|*.json)"]
EOF

# 2. Phase 驱动工作流状态机
cat <<EOF > ./diagrams_src/2_phase_workflow.mmd
stateDiagram-v2
    [*] --> Phase0: Intent Capture
    Phase0 --> Phase1: Spec Generation
    Phase1 --> Phase2: Implementation Plan
    Phase2 --> Phase3: Code Generation
    Phase3 --> Phase4: Verification
    Phase4 --> Phase5: Completion
    Phase4 --> Phase3: Gate Failed (Retry)
    Phase5 --> [*]
EOF

# 3. Agent 响应流水线
cat <<EOF > ./diagrams_src/3_agent_pipeline.mmd
sequenceDiagram
    participant O as Orchestrator
    participant A as BaseAgent
    participant L as LLMManager
    participant F as FileSystem
    O->>A: execute(context)
    A->>A: preparePrompt()
    A->>L: generateResponse(prompt)
    L-->>A: Markdown Result
    A->>A: parseResponse()
    A->>F: writeArtifacts()
    A-->>O: AgentResult
EOF

# 4. LLM 降级与管理策略
cat <<EOF > ./diagrams_src/4_llm_management.mmd
graph LR
    M[LLMManager] --> C1[OpenAI Client]
    M --> C2[Anthropic Client]
    M --> C3[DeepSeek Client]
    M -->|Fallback| Mock[MockLLMClient]
    C1 -->|Timeout/Error| M
    M -->|Switch| C3
EOF

# 5. 任务依赖编排逻辑
cat <<EOF > ./diagrams_src/5_orchestration_deps.mmd
graph TD
    T1[Task A] --> T2[Task B]
    T1 --> T3[Task C]
    T2 --> T4[Task D]
    T3 --> T4
    T4 -->|Check Dependencies| ORC[Orchestrator]
    ORC -->|Topo Sort| Execute[Execution Order]
EOF

# 6. 验证关卡 (Verification Gates)
cat <<EOF > ./diagrams_src/6_verification_gates.mmd
graph TD
    Code[Generated Code] --> D[DeepCode Gate]
    D -->|Check AST/Security| O[OpenSpec Gate]
    O -->|Check Spec Compliance| Result{Passed?}
    Result -->|Yes| Next[Next Phase]
    Result -->|No| Fix[Self-Correction Agent]
EOF

# 7. 数据持久化与事件流
cat <<EOF > ./diagrams_src/7_data_flow.mmd
graph LR
    E[EventStore] -->|Append| Log[.bmad/events.json]
    S[PhaseController] -->|Save| State[.bmad/phase.state.json]
    A[ArtifactManager] -->|Write| Output[src/...]
EOF

# 8. Web UI 与 API 服务
cat <<EOF > ./diagrams_src/8_web_api.mmd
graph TD
    Browser[Dashboard UI] -->|REST API| Express[Express Server]
    Express -->|Routes| Changes[changes.ts]
    Express -->|Routes| Workflow[workflow.ts]
    Changes -->|Read/Write| Storage[Local JSON Storage]
EOF

# 批量转换
for file in ./diagrams_src/*.mmd; do
    filename=$(basename "$file" .mmd)
    echo "正在生成: $filename.svg"
    mmdc -i "$file" -o "./output_images/$filename.svg" -b transparent
done

echo "所有图片已生成在 ./output_images 目录中！"