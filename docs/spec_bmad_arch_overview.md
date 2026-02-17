# Architecture Overview Draft

This document codifies the unified architecture as per SpecBmad Unified Architecture v2 Frozen Edition. It outlines phase-driven governance, domain boundaries, interaction patterns, and reference artifacts to be used by the development teams.

Key references:
- Phase 0–5 governance (Phase Controller, OpenSpec, DeepCode, BMAD Agents)
- Domain boundaries: Spec Domain (Python), Execution Domain (Node.js/TS), Intelligence Domain (DeepCode/LLM Gateway)
- Gate rules: Phase transitions, non-functional gates, failure modes
- Repository structure: /spec, /plan, /code, /verification, /events
- Primary diagrams: Mermaid architecture (6.1.6), architecture layers diagram

## 1. Target State vs Current State
- Target state: A phase-governed, spec-first, verifiable architecture with clearly defined boundaries and contracts, enabling safe evolution via ADRs and staged migrations.
- Current frozen edition provides the governance and boundary rules; further work is required to operationalize contracts, interfaces, and observability.

## 2. Architecture Boundaries & Domains
- Spec Domain (Python)
  - Components: Spec-Kit, OpenSpec
  - Governance: Read-only Spec for Execution Domain
- Execution Domain (Node.js / TS)
  - Components: BMAD-CORE, Role Agents
  - Governance: Interfaces to Spec only; no Spec mutation
- Intelligence Domain
  - Components: DeepCode, LLM Gateway
  - Role: Judgment and verification, not decision making

## 3. Phase Controller & Gate Rules
- Phase Controller is the single source of truth for transitions
- Gates: OpenSpec, DeepCode, Verification, Event Store triggers
- Phases: 0 Intent Capture → 1 Formal Specification → 2 Architecture & Planning → 3 Implementation → 4 Verification → 5 Iteration/Evolution

## 4. Reference Architecture Diagram (Mermaid)
```mermaid
graph TB
  CLI[Unified CLI] --> OR[Orchestrator]
  UI[Web UI] --> OR
  OR --> PhaseCtrl[Phase Controller]
  PhaseCtrl --> SpecKit[Spec-Kit]
  SpecKit --> OpenSpec[OpenSpec]
  PhaseCtrl --> BMAD[BMAD Agents]
  BMAD --> DC[DeepCode]
  DC --> LLM[LLM Gateway]
  LLM --> 
```

## 5. Running & Verification Artifacts
- Workflow.state.json / event_log.jsonl in /events
- Assets: ./assets/diagrams/架构层次图.svg, Orchestrator-工作流程.svg

## 6. Immediate Next Steps
- Create Architecture.md in docs/architecture/overview_v2.md
- Create ADRs: ADR-ARCH-001, ADR-ARCH-002, ADR-ARCH-003, ADR-ARCH-004
- Define Phase 0–5 reference plan and gating contracts
- Add Phase 0 intent.yaml / formal_spec.yaml templates

---

End of draft.
