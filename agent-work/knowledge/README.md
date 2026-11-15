# Knowledge packs

Packs seed a subagent so it starts working without searching for what is already known. They are
general: one pack serves many steps. A step lists the packs it needs.

| Pack | Read it when you |
| --- | --- |
| `core.md` | Always. Every agent, first. |
| `checks-and-tooling.md` | Run anything: checks, the browser, Docker, secrets |
| `signet-domain.md` | Touch events, requests, lifecycles or verification |
| `midnight-indexer.md` | Read the chain: the indexer's API and what is known about its behaviour |
| `ui-codebase.md` | Touch `packages/ui` (before stage 02: the repository root `src/`) |
| `backend-conventions.md` | Touch `packages/backend`: database, repositories, configuration, logging |
| `service-pattern.md` | Touch `packages/api` or anything that implements or calls a service |

## Evidence marks

Every fact carries one mark. A fact with no mark is a defect: report it.

- `[run]` a command was executed and its output read. The command or script is named.
- `[read]` read in a file. The file and line are named. The behaviour was not executed.
- `[unverified]` believed, not checked. Treat as a hypothesis. If your step depends on it, check
  it first and report what you found.

## Rules for packs

- A pack holds what the code cannot tell you quickly: conventions, external facts, pitfalls,
  commands, decisions. It points at paths. It never copies code.
- Paths are relative to the worktree root unless they start with `/` or `~`.
- When a step moves or renames something a pack names, the step's report lists it under
  `Knowledge corrections`, and the orchestrator updates the pack in the same commit.
- Subagents never edit packs. They report corrections with evidence.
