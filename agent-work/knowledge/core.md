# Core pack: read first, every time

## What this task is

The explorer is a React app that shows Sig Network (Signet) activity on Midnight. Today the
browser reads the Midnight indexer directly. This task adds a Node backend with Postgres that
reads the chain and serves the UI, and turns the repository into a Yarn workspace monorepo.
`agent-work/architecture.md` is the design. `agent-work/decisions.md` is what is already settled.

You are one subagent doing one step. The orchestrator gave you a worktree path and a step id.

## Your contract

1. Work only inside the worktree path you were given.
2. Do only your step. If you find a problem outside its scope, report it. Do not fix it.
3. Never touch git state: no `add`, `commit`, `push`, `stash`, `checkout`, `restore`, `reset`.
   The orchestrator commits. Leave your changes in the working tree.
4. Never write in `agent-work/`, except a stage's `evidence/` folder when your step names it.
5. Reply with the report in `agent-work/templates/step-report.md`. Nothing else is read.
6. You may stop early. `BLOCKED` with a precise question, or `REFUSED` with the reason, is a good
   outcome when the step is unclear, mis-shaped or beyond you. A confident wrong result is the
   worst outcome.
7. Run your step's exit check yourself before you report `DONE`, and quote its decisive output.
8. A claim in your report must come from something you ran or read in this session. Say which.
   "I did not find it" is not "it does not exist": say what you searched.

## Rules agents break most (all of them are hard rules)

Your session loads the user's global rules and the repository's engineering rules on its own.
Stage 01 confirms that. These are the ones that cause rework:

- **No em dash (U+2014) and no semicolon as prose punctuation**, anywhere you write: code
  comments, docs, commit text, log strings, your report. Rewrite the sentence. British spelling.
  Semicolons as code tokens are fine.
- **Dependencies go in a package's manifest and are installed from it** (`yarn add` in that
  workspace). Never `npm install -g`, never `pip install`. A one-off script uses `yarn dlx` or
  `uv run --with`.
- **Comments say what the code IS.** Never what it was, never a rejected alternative, never a
  restatement of the code. Default is no comment. One sentence when an invariant needs it.
- **No `any`, no double casts, no non-null assertions, no lint suppressions.** `unknown` only at
  an external input boundary, narrowed there (zod).
- **The file's focus comes first:** the declaration a file is named after is the first one after
  the imports. Module-level values evaluated at load time (zod schemas, Drizzle tables) are the
  exception and keep evaluation order.
- **The mover pays:** when you move, rename or delete anything, grep the whole repository for the
  old name (path, identifier, phrase) and fix every hit in the same step. Documentation included.
- **Census consumers before shaping shared code.** List the real consumers by searching. Shape
  the shared thing for all of them, not for the one that brought you there.
- **Adding a second member renames the first:** a qualified twin (`fakeNetworkService`) beside a
  bare original (`networkService`) means the original needs its own qualifier in the same change.
- **A secret never reaches your output.** Pipe anything that may print configuration through
  `redact` (`cat .env.local | redact`). Indexer and RPC URLs carry keys in their query string.
  Never print one, log one, or return one from an API.
- **UI elements are shadcn/ui components** from the UI's `components/ui` folder (installed with
  the shadcn CLI). Never hand-roll a primitive. Never put a cursor class on a control.
- **Keep the ledger WebAssembly off the first page load** and out of `lib` and `api`
  (see `ui-codebase.md`).

## Where things are

| What | Where |
| --- | --- |
| Main worktree | `/home/brbussy/Projects/github.com/sig-net/explorer-upgrade-protocol` |
| The reference for backend patterns | `~/Projects/github.com/sig-net/full-stack-demo-rebuild` (branch `bernard/rebuild` of `sig-net/full-stack-demo`). Read only. |
| The MPC's Midnight indexer, for the no-gaps design | `~/Projects/github.com/sig-net/mpc/chain-signatures/chain-midnight/src/indexer.rs`. Read only. |
| The Signet SDK | `node_modules/@sig-net/midnight` (types in `dist/*.d.ts`) |

If a reference checkout is missing, report `BLOCKED`. Do not clone it yourself.

## Machine facts

- This is the user's dev box, a persistent virtual machine. Other sessions share it. Run
  `docker ps` before starting any container: one that is already up belongs to someone else.
- The home network and other machines are unreachable by design. The internet is open.
- Shared test secrets: `dev-secrets list` (names only), `dev-secrets get <NAME>` (use inside a
  command, never print). A value goes only into a gitignored env file.
- Node 26 and Yarn 4.18.0 through Corepack. `[run]` `node -v`, `yarn -v` in the planning session.
