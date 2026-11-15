#!/bin/bash
# Exit check of step 01.2. Runs in the step's own worktree.
set -euo pipefail

f=.dockerignore
grep -qx 'probes' "$f" || { echo "$f has no line that is exactly: probes" >&2; exit 1; }
grep -qx 'agent-work' "$f" || { echo "$f lost its agent-work line" >&2; exit 1; }
grep -qx '\.env\*' "$f" || { echo "$f lost its .env* line" >&2; exit 1; }
removed="$(git diff --numstat "$AGENT_WORK_PARENT"...HEAD -- "$f" | awk '{print $2}')"
test "${removed:-0}" = 0 || { echo "$f lost $removed line(s): the step only adds" >&2; exit 1; }
