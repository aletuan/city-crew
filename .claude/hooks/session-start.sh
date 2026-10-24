#!/bin/bash
# Installs the three workspaces' dependencies in a Claude Code cloud
# session, so the gates in CLAUDE.md can run from the first command.
#
# A cloud container starts from a fresh clone with no node_modules, and
# the first `npm run typecheck` of a session used to fail on that rather
# than on anything in the code. Locally the hook does nothing: a laptop
# keeps its own node_modules, and installing over them unasked is not
# this hook's business.
#
# `npm ci` and not `npm install`: install may rewrite package-lock.json,
# and a lockfile changed by a session start would ride the next commit
# unnoticed. ci is slower, so it runs only when the lockfile differs
# from the one the last install was made from — the container is cached
# after this hook, and a resumed session with an unchanged lock skips
# all three in well under a second.
#
# Synchronous on purpose: async would let the session's first gate run
# race the install and fail the same way the missing node_modules did.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

for ws in app dashboard data; do
  dir="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}/$ws"
  stamp="$dir/node_modules/.claude-lock-sha"
  want=$(sha256sum "$dir/package-lock.json" | cut -d' ' -f1)
  if [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$want" ]; then
    continue
  fi
  echo "session-start: npm ci in $ws/" >&2
  (cd "$dir" && npm ci --no-audit --no-fund --no-update-notifier --loglevel=error >&2)
  echo "$want" > "$stamp"
done
