#!/bin/bash
# Shared by the exit checks of stage 01: what every findings file must hold.

# findings_ok <name> "<gate ids>" "<number keys>": the file exists, names its probe, and holds a
# verdict with evidence for each gate and a number under each key.
findings_ok() {
  local name="$1" gates="$2" numbers="$3" file="agent-work/probes/findings/$1.json"
  test -f "$file" || { echo "$file is missing" >&2; return 1; }
  jq -e --arg name "$name" '.probe == $name and (.head | type == "number")' "$file" > /dev/null ||
    { echo "$file: probe is not \"$name\" or head is not a number" >&2; return 1; }
  local gate key
  for gate in $gates; do
    jq -e --arg gate "$gate" '.gates[$gate]
      | (.verdict | IN("holds", "fails", "not-observed")) and (.evidence | type == "string" and length > 20)' \
      "$file" > /dev/null || { echo "$file: gate $gate has no verdict with evidence" >&2; return 1; }
  done
  for key in $numbers; do
    jq -e --arg key "$key" '.numbers[$key] | type == "number"' "$file" > /dev/null ||
      { echo "$file: numbers.$key is not a number" >&2; return 1; }
  done
}

# verdicts_of <name> "<gate ids>": the verdicts the findings file holds, as one line of JSON.
verdicts_of() {
  jq -cS --arg gates "$2" '.gates | with_entries(select(.key as $k | ($gates | split(" ")) | index($k))) | map_values(.verdict)' \
    "agent-work/probes/findings/$1.json"
}

# The indexer URL for a probe run, never printed.
indexer_url() {
  printf 'https://midnight-preprod.blockfrost.io/api/v0?project_id=%s' \
    "$(dev-secrets get MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID)"
}

# The repository's lint, which reads the probe files.
repo_checks() {
  yarn install --immutable > /dev/null
  yarn lint
}
