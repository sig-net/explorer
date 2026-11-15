# Stage 07: release wiring and close

## Delivers

The repository tells the truth about itself: documentation and engineering rules describe the
monorepo and the backend, the workflows build what now exists, a final review of the whole task
has been answered, and the user receives a hand-back that says what was built, what was not
tested and what they must decide.

## Assumes

- Stage 06 is done and its checks pass.
- Gate G7 decided whether a workflow change can be pushed from this machine.
- Earlier stages recorded the workflow lines to change (02.1, 06.5).

## Shape

Documentation and rules (07.1) and the workflows (07.2) touch different files and run in
parallel in the main worktree. The final review (07.3) reads the whole task. The hand-back
(07.4) is the orchestrator's.

```
( 07.1 | 07.2 ) -> 07.3 review -> fixes -> 07.4
```

## Steps

### Step 07.1: documentation and engineering rules

- **Stream / model:** `workspace` / `fable`
- **Waits on:** nothing
- **Runs in:** main worktree
- **Packs:** all
- **Scope:** `README.md`, `docs/`, a new `DECISIONS.md`, the repository's engineering rules file,
  `.env.local.example`, comments
- **Context:** heavy
- **Goal:** A reader who has never seen `agent-work/` can run, change and operate the system.
- **Work:**
  1. `README.md`: what the explorer is, the packages, requirements, getting started (stack, the
     backend, the UI), every script, every variable of the UI and of the backend, the operations
     commands, the images. Every command quoted is run verbatim first. Remove every section that
     describes the browser reading the indexer, the starting block or the editable configuration.
  2. `docs/architecture.md`: the design as it was BUILT, written for people, from
     `agent-work/architecture.md` corrected against the code. No reference to `agent-work/`, to
     stages or to agents.
  3. `DECISIONS.md` at the root: the decisions a maintainer needs with their reasons (from
     `agent-work/decisions.md`), in the present tense, without the history of how they were
     reached.
  4. The repository's engineering rules file: add what future agents must not get wrong, as
     prohibitions and requirements: the dependency direction, the `api` and `lib` runtime
     constraints, the ingestion invariants (whole ranges, one transaction, never skip, single
     writer), the aggregate table equals a rebuild, no migrations, no secret in a reply or a log,
     the read-through caches, verification stays in the UI. Update every path the monorepo moved.
  5. Sweep every comment written during the task for history words and negative-space claims
     (previously, originally, no longer, used to, legacy, old, instead of, rather than) and for
     comments that restate code. Read each hit.
  6. Grep the whole repository, outside `agent-work/`, for `dark mode` (case-insensitive), for
     the em dash, and for prose semicolons in documentation, and fix each.
  7. No human-facing text may tell a reader to open an agent instruction file.
- **Exit check:** every command in `README.md` was run and its result noted in the report.
  `git grep -n "agent-work" -- ':!agent-work'` returns nothing.
- **Report must include:** the list of commands run from the README.

### Step 07.2: workflows

- **Stream / model:** `workspace` / `opus`
- **Waits on:** nothing
- **Runs in:** own worktree `bernard/07-workflows` (so its commit stays separate and last)
- **Packs:** `checks-and-tooling.md`
- **Scope:** `.github/workflows/`
- **Context:** light
- **Goal:** The workflows build the monorepo, and a check runs on a branch.
- **Work:**
  1. `pages-deploy.yml`: paths for the UI package, the base path, the 404 copy, the artifact path.
     The build needs the backend URL: decide with the orchestrator whether it comes from a
     repository variable, and name it in the report. Do not invent a URL.
  2. `docker-publish.yml`: both images, named as stage 06 named them.
  3. A new workflow that runs `yarn check` and the build on pull requests, with no secret. The
     integration tests need Postgres: add a job with a Postgres service only if it needs no
     secret, otherwise leave it out and say so.
  4. Keep every action pinned by commit hash as the existing files do. Do not add an action whose
     hash you cannot verify from its repository.
  5. Validate the YAML and, as far as possible without pushing, the expressions (a linter run
     through `yarn dlx` or `uv run --with`, never installed onto the machine).
- **Exit check:** the linter passes on all workflow files. A dry reading of each job against the
  repository: every path it names exists.
- **Report must include:** what could not be verified without running the workflow on GitHub.

The orchestrator merges this worktree LAST. If gate G7 said a workflow push is refused, the merge
commit stays local and unpushed, and the hand-back says so.

### Step 07.3: final review of the whole task

- **Stream / model:** `review` / three fresh `fable` agents in parallel, each with one lens
- **Waits on:** 07.1 merged
- **Runs in:** main worktree, read only
- **Packs:** all
- **Scope:** none
- **Context:** heavy
- **Goal:** Review `git diff e0c1309..HEAD -- ':!agent-work'` as if it were a pull request.
- **Work:**
  1. Lens one, correctness: the ingester, the chain source, the projection, the services.
  2. Lens two, the rules: every rule of the repository and of the user, applied to the whole
     diff. Names that became untrue, comments, types, dependencies, file layout.
  3. Lens three, the outside view: a new maintainer follows the README from a clean clone in a
     throwaway worktree, and an operator runs each command. Everything that does not work as
     written is a finding.
  4. Each runs the full check.
- **Exit check:** findings with file, line and a concrete failure, or "none".
- **Report must include:** findings ranked by severity.

The orchestrator sends confirmed findings to the owning streams, re-runs the checks, and repeats
the review lens for any area that changed substantially.

### Step 07.4: hand back

- **Stream / model:** orchestrator
- **Waits on:** 07.3 and its fixes, 07.2 merged
- **Runs in:** main worktree
- **Packs:** none
- **Scope:** `agent-work/` only
- **Context:** light
- **Goal:** The user knows exactly where things stand.
- **Work:**
  1. Run the stage exit check.
  2. Write the hand-back in the stage log and in the reply to the user:
     - what was built, in a few lines,
     - how to run it locally (the commands),
     - the "To be tested" list from `index.md`,
     - decisions made by the planner or the orchestrator that the user has not confirmed
       (`decisions.md`, `Decided by` other than `user`),
     - anything unpushed and why,
     - tools installed on the machine during the task and why, for the guest blueprint,
     - that `agent-work/` is still in the branch, for the user to remove before a pull request.
  3. Send one `notify-user` message that the task is complete, with the branch name.
- **Exit check:** `index.md` shows every stage `done`.
- **Report must include:** not applicable (orchestrator step).

## Gates

| Gate | Question | Fallback |
| --- | --- | --- |
| G15 | Where does the Pages build get the backend URL? | The workflow reads a repository variable. Until the user sets it, the deployed UI shows a clear "no backend configured" state. The hand-back names the variable |

## Stage exit check

From a clean clone of the branch in a throwaway worktree (to prove nothing depends on untracked
files):

1. `yarn install --immutable && yarn check && yarn build`.
2. The two `.wasm` files and no third.
3. Write `.env.local` from the shared secrets, `yarn stack:restart`, `yarn test:integration`.
4. Start the backend, index preprod to the head, `audit preprod` clean.
5. Smoke in real mode and in fake mode.
6. Both images build.
7. `git grep -n "agent-work" -- ':!agent-work'` returns nothing.
8. `git status --short` is empty and `git log origin/upgrade-protocol..HEAD` shows only what the
   hand-back says is unpushed.

## Checkpoint

Commit and push. Mark stage 07 `done` in `index.md`. The task is complete. Do not open a pull
request and do not remove `agent-work/`: both are the user's to do.
