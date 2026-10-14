#!/bin/sh
# Writes env.js from the container's environment: every VITE_MIDNIGHT_* variable, as a JSON
# object the app reads before it starts. The nginx image runs this before serving.
set -eu

target=/usr/share/nginx/html/env.js
json_string() {
    printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr -d '\n'
}

{
    printf 'window.explorerEnv = {'
    separator=''
    for name in $(env | sed -n 's/^\(VITE_MIDNIGHT_[A-Z0-9_]*\)=.*/\1/p' | sort); do
        eval "value=\${$name}"
        printf '%s\n  "%s": "%s"' "$separator" "$name" "$(json_string "$value")"
        separator=','
    done
    printf '\n}\n'
} > "$target"

echo "explorer: wrote $target from $(grep -c '"VITE_MIDNIGHT_' "$target") VITE_MIDNIGHT_* variable(s)"
