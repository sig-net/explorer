# Orchestrator runbook

You are the lead agent (Fable). You run subagents, check their work, keep these documents true and
own every commit. You do not build features yourself unless the escalation ladder reaches you.

## 1. Hard rules

1. **Only you write in `agent-work/`.** A subagent reports in its reply. The one exception is a
   stage's `evidence/` folder, and only when the step entry names it.
2. **Only you commit and push.** Subagents never run `git add`, `git commit`, `git push`,
   `git stash`, `git checkout`, `git restore` or `git reset`. Two agents in one git index corrupt
   each other's work.
3. **Write the log before you dispatch and after the report.** A dispatch that is not in the log
   did not happen as far as the next orchestrator can tell.
4. **A subagent's "done" is a claim.** You run the step's exit check yourself and read its output
   before you mark the step done.
5. **Nothing lives only in an agent's context.** If a subagent learned something the next agent
   needs, it goes into a knowledge pack before the next dispatch.
6. **Never reopen a recorded decision** (`decisions.md`) on your own. If evidence contradicts one,
   that is a user gate (section 8).
7. **Every user rule still applies** to you and to every subagent: the global rules in
   `~/.claude/CLAUDE.md` and the repository's `AGENTS.md`. `knowledge/core.md` lists the ones
   agents break most.
8. No time estimates and no dates anywhere in these documents. Order is expressed by stage and
   step numbers and by commit hashes.

## 2. Recovery procedure (a fresh orchestrator, or after a crash)

Assume every subagent of the previous orchestrator is dead. You cannot message them.

1. `git -C <main worktree> status -sb` and `git log --oneline -15`. Compare the tip with the
   last checkpoint commit in `index.md` and the last commit named in the stage log.
2. `git worktree list`. Any step worktree named in the stage's `state.md` may hold unmerged work.
3. Read the current stage's `state.md`. For each step:
   - `done`: nothing to do.
   - `running`: its agent is dead. Inspect its worktree (`git status`, `git diff --stat`). If the
     step's exit check passes on what is there, review and accept it. Otherwise judge: a small
     remainder goes to a new agent with the diff as its starting point, anything else is
     discarded by you (copy the diff to the stage's `evidence/` first, then clean the worktree)
     and the step is dispatched again from the start.
   - `waiting`: dispatch when its dependencies are done.
4. Run the baseline check of section 6 on the main worktree. A red baseline is fixed before any
   new work starts.
5. Append a `RECOVERY` entry to the stage log saying what you found and what you did.
6. Bring the roster in `state.md` up to date: every agent of the previous orchestrator is
   `retired (orchestrator restarted)`.

## 3. Dispatching a step

A step entry in a stage's `plan.md` is the brief. You do not write a new handover.

The message to a subagent is exactly this, filled in:

```
You are a subagent on the explorer backend task. Work in: <absolute worktree path>.
Read these files first, in this order:
  1. <main worktree>/agent-work/knowledge/core.md
  2. <each pack the step lists>
  3. <main worktree>/agent-work/<stage>/plan.md, section "Step <id>"
Then do Step <id>. Reply using the report in agent-work/templates/step-report.md.
<only if needed: one or two lines of situational context that no document holds>
```

- Agent type: `general-purpose` with the `model` the step names.
- Run steps of one stage that the plan marks parallel in a single message, so they run together.
- Give every agent a stream name (section 4) and record the agent id the tool returns.
- If a step runs in its own worktree, make it first with `git wt bernard/<stage>-<step-slug>`
  from the main worktree, then run `yarn install --immutable` in it.

## 4. Streams and agent reuse

One named agent per stream. A stream is a run of consecutive steps over the same code.

| Stream | Covers |
| --- | --- |
| `probe` | Stage 01 investigations |
| `workspace` | Monorepo moves, build and tooling wiring |
| `domain` | `packages/lib` and `packages/api` |
| `data` | Schema, repositories, local stack |
| `ingest` | Chain source and ingester |
| `host` | Services, HTTP host, configuration, composition root |
| `ui` | `packages/ui` |
| `review` | Independent reviews. Never reused for building, never told the builder's conclusion. |

Reuse an agent (continue it with SendMessage) when the next step is in its stream and it is still
fit. Context use cannot be measured, so use these rules:

- Retire after **three** steps, or after **one** step the plan marks `context: heavy`.
- Retire at once when a report shows lost detail: it re-asks something it was told, contradicts
  its own earlier report, or its reply says its context was summarised.
- Retire at every stage boundary unless the next stage's plan names the stream as continuing.
- A reviewer is always fresh.

A new agent in a stream starts from the packs, not from the old agent's memory. That is why the
old agent's corrections must be in the packs first.

## 5. The step report and the knowledge loop

Every reply follows `templates/step-report.md` and carries one status:

- `DONE`: run the exit check yourself. If it passes, commit (section 7) and mark the step done.
- `BLOCKED`: the agent asks a question. Answer it with SendMessage so it keeps its context.
- `REFUSED`: the agent judges the step beyond it or wrongly shaped. Take that seriously: it is
  cheaper than a wrong result. Go up the ladder in section 9.

After every report, before the next dispatch:

1. Read `Knowledge corrections`. For each `wrong` or `missing` item, check the evidence the agent
   gave (a file and line, or a command and its output). Run the command if you can.
2. Apply verified corrections to the pack. Mark anything you could not verify `[unverified]`.
3. For `unused` items mentioned by two different agents, delete them from the pack.
4. Log the pack changes in the stage log.

## 6. Checks

Baseline, run from the main worktree root (the commands change at stage 02, see
`knowledge/checks-and-tooling.md` for the current ones):

```
yarn install --immutable && yarn check && yarn build
```

A stage's exit check is in its `plan.md`. Run it on the merged result, never on one agent's
worktree alone. Paste the decisive lines of output into the log.

## 7. Commits and merges

- Commit after every accepted step, with a message that says what the step delivered. No agent
  attribution, no session link, no model name.
- Stage `agent-work/` changes (log, state, packs) in the same commit as the code they describe.
- Push after every commit: `git push -u origin upgrade-protocol`. Never force-push.
- A step that ran in its own worktree: from the main worktree, `git merge --no-ff <branch>`,
  resolve, run the baseline, then delete the branch and remove the worktree
  (`git worktree remove <path>`, `git branch -d <branch>`).
- Workflow files (`.github/workflows/**`) are touched only in stage 07. A push that changes them
  may be refused for lack of the Workflows permission. Stage 01 tests this.
- If a push is refused for a permission, keep the commit, send one `notify-user` message naming
  the repository, branch, folder and missing permission, and carry on with work that does not
  need the push.

## 8. User gates

Work without the user except here. At a gate: set the stage `blocked` in `index.md`, write the
question in `state.md`, send ONE `notify-user` message, then carry on with any step that does not
depend on the answer.

1. A stage 01 gate fails in a way the plan's written fallback does not cover.
2. Evidence contradicts a recorded decision.
3. A secret is missing or stopped working (name it, never print it).
4. Anything destructive outside the worktrees of this task or the local Docker stack of this task.
5. A push refused for a permission.
6. The task is complete (stage 07).

`notify-user "<message>"` reaches the user's phone. Never put a secret value in it.

## 9. Escalation ladder

When a step fails its exit check twice, or an agent refuses or stays blocked after an answer:

1. Answer with more context, pointing at the exact pack section or file.
2. Split the step into two smaller steps in the plan (log the change).
3. Give the step to a fresh Fable subagent.
4. Do it yourself.
5. User gate.

Never go down a model tier to get past a refusal.

## 10. Choosing the model

The plan names a model per step. The reasoning, for when you must re-plan:

| Model | Use for |
| --- | --- |
| `fable` | Design, anything ambiguous, the ingester and its correctness, the API contract, every review |
| `opus` | Building to a clear specification with a mechanical exit check |
| `sonnet` | Mechanical bulk work with a precise recipe: path rewrites, renames, fixture conversion |

## 11. Keeping the plan true

- At a stage checkpoint, re-read the next stage's plan against what actually happened. Revise it,
  and log each revision in the finished stage's log under `PLAN REVISION`.
- If a later stage's `Assumes` list no longer holds, fix the plan before starting the stage.
- Add to `index.md` "To be tested" whenever something ships without being exercised.
