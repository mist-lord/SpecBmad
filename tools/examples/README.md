# Examples

This folder contains runnable examples using the CLI.

## Sprint Planning

Runs the `tasks` flow to generate a planning summary via the configured LLM (OpenAI gateway or Mock fallback).

Prerequisites:
- Build the project: `npm run build`
- Configure `.specbmad/config.json` with LLM settings (already set by previous steps)

Run:

```bash
npm run example:sprint
```

Expected:
- A new markdown output is generated under `.bmad/` (e.g., `llm-dashboard-openai*.md`)
- Console shows agent orchestration and timing