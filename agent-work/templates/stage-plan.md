# Stage NN: <name>

## Delivers

<one paragraph: what exists at the checkpoint that did not before>

## Assumes

<what this stage relies on from earlier stages and from decisions. The orchestrator checks each
line before starting the stage and revises the plan if one no longer holds>

## Shape

<which steps run in parallel, which wait, and why. Where each runs: the main worktree or its
own, and the reason>

```
<a small dependency sketch>
```

## Steps

### Step NN.M: <title>

- **Stream / model:** <stream> / <fable | opus | sonnet>
- **Waits on:** <step ids, or "nothing">
- **Runs in:** <main worktree | own worktree `bernard/<slug>`>
- **Packs:** <packs beyond core.md>
- **Scope:** <files and folders this step may change>
- **Context:** <light | heavy>
- **Goal:** <one or two sentences>
- **Work:**
  1. <ordered, concrete>
- **Exit check:** <command and the output that means pass>
- **Report must include:** <anything beyond the standard report>

## Gates

<decisions this stage must make, each with the question, how it is answered, and the written
fallback for each outcome. "none" if the stage has no gate>

## Stage exit check

<run by the orchestrator on the merged result. Commands and expected output>

## Checkpoint

<what is committed, what is updated in index.md, which packs are rewritten, what is reviewed
against the next stage's plan>
