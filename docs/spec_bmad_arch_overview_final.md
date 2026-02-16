# Architecture Overview (Unified) - Frozen v2.2

This document is the canonical reference for SpecBmad Unified Architecture v2, Frozen Edition. It captures Phase-driven governance, domain boundaries, and interfaces required to implement the architecture as described in the frozen edition.

1) Phase Governance
- Phase 0 Intent Capture: Owner Spec-Kit; output intent.yaml
- Phase 1 Formal Specification: OpenSpec; output formal_spec.yaml
- Phase 2 Architecture & Planning: BMAD (PM/Architect); outputs: architecture.md, plan.yaml
- Phase 3 Implementation: BMAD-DEV; DeepCode as verifier; output code in /code
- Phase 4 Verification: OpenSpec + DeepCode; outputs verification_report.md
- Phase 5 Iteration/Evolution: Phase Controller; inputs Event Store; supports rollback to Phase 1 or 3

2) Domain Boundaries
- Spec Domain (Python): Spec-Kit, OpenSpec; read-only for Execution Domain
- Execution Domain (Node.js/TS): BMAD-CORE, Role Agents; can read Spec but not modify
- Intelligence Domain: DeepCode, LLM Gateway; responsible for evaluation and verification

3) Interaction & Gate Rules
- Node.js → Python allowed; Python → Node.js prohibited (except Phase Controller)
- Gate 1–4 enforce via Phase Controller; gate decisions recorded in Event Store

4) Reference Architecture Diagram (Mermaid)
```mermaid
flowchart TB
  CLI[CLI] --> OR[Orchestrator]
  UI[Web UI] --> OR
  OR --> PhaseCtrl[Phase Controller]
  PhaseCtrl --> SpecKit[Spec-Kit]
  SpecKit --> OpenSpec[OpenSpec]
  PhaseCtrl --> BMAD[BMAD Agents]
  BMAD --> DC[DeepCode]
  DC --> LLM[LLM Gateway]
  LLM --> 
```

5) Repository Layout (as frozen)
- /spec, /plan, /code, /verification, /events
- Arch diagrams in ./assets/diagrams/

6) Quick Runbook
- 1) Gather intent.yaml, formal_spec.yaml
- 2) Run OpenSpec checks; generate architecture.md, plan.yaml
- 3) Implement BMAD-DEV with phase constraints
- 4) Run verification; log into verification_report.md
- 5) Phase Controller enforces transitions; Event Store logs all transitions

7) Next Steps (Concretely)
- Create ADRs for target architecture patterns
- Fill in AS-IS / TO-BE diagrams
- Start PoC for a bounded-context pair
- Instrument observability dashboards

End of document.
