#!/bin/bash
# Exit check of step 01.1: the machinery file of the fable step exists and holds what was asked.
set -euo pipefail
f=agent-work/probes/machinery/fable.txt
test -f "$f" || { echo "$f is missing" >&2; exit 1; }
sed -n 1p "$f" | grep -qE '^bernard-' || { echo "line 1 is not the step's branch" >&2; exit 1; }
sed -n 2p "$f" | grep -qE '^v[0-9]+\.' || { echo "line 2 is not a Node version" >&2; exit 1; }
sed -n 3p "$f" | grep -qx '4.18.0' || { echo "line 3 is not the Yarn version 4.18.0" >&2; exit 1; }
test "$(wc -l < "$f")" -eq 3 || { echo "the file must hold exactly three lines" >&2; exit 1; }
