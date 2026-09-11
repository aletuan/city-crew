#!/usr/bin/env bash
# Run the iOS smoke suite with the test account from the macOS Keychain,
# and keep every run's report, logs and failure screenshots where they can
# be read back afterwards.
#
#   npm run smoke:ios                       # all flows
#   npm run smoke:ios -- .maestro/05-plan-trip.yaml   # one flow
#
# One-time setup (see README.md, "Test account"):
#   security add-generic-password -s citycrew-maestro -a <test-email> -w
#
# Environment overrides: EXPO_URL (default exp://127.0.0.1:8081 — the
# simulator is on this Mac, so loopback always reaches Metro), TEST_EMAIL,
# TEST_PASSWORD. Nothing here prints the password.
set -euo pipefail

SERVICE=citycrew-maestro
here="$(cd "$(dirname "$0")" && pwd)"
app="$(dirname "$here")"
repo="$(dirname "$app")"
cd "$app"

die() { printf '✗ %s\n' "$*" >&2; exit 1; }

# ── tools ──
command -v maestro >/dev/null || die "maestro not found — see .maestro/README.md, One-time setup."
if [ -z "${JAVA_HOME:-}" ] && [ -x /usr/libexec/java_home ]; then
  JAVA_HOME="$(/usr/libexec/java_home -v 17+ 2>/dev/null || true)"
  [ -n "$JAVA_HOME" ] && export JAVA_HOME
fi

# ── Metro ──
EXPO_URL="${EXPO_URL:-exp://127.0.0.1:8081}"
status_url="http://$(printf '%s' "$EXPO_URL" | sed -E 's#^exp://##; s#/.*$##')/status"
if ! curl -fs --max-time 3 "$status_url" | grep -q 'packager-status:running'; then
  die "Metro is not answering at ${status_url%/status}. Start it in another tab: cd app && npx expo start"
fi

# ── test account ──
if [ -z "${TEST_EMAIL:-}" ]; then
  TEST_EMAIL="$(security find-generic-password -s "$SERVICE" 2>/dev/null \
    | sed -n 's/^ *"acct"<blob>="\(.*\)"$/\1/p' || true)"
fi
if [ -z "${TEST_PASSWORD:-}" ]; then
  TEST_PASSWORD="$(security find-generic-password -s "$SERVICE" -w 2>/dev/null || true)"
fi
[ -n "$TEST_EMAIL" ] && [ -n "$TEST_PASSWORD" ] || die "No test account in the Keychain.
  Add it once:  security add-generic-password -s $SERVICE -a <test-email> -w
  (it prompts for the password, so it never reaches the shell history)"

# ── run ──
run="$repo/.smoke-local/maestro/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$run"
targets=("$@")
[ ${#targets[@]} -eq 0 ] && targets=(.maestro)

printf '▶ %s as %s → %s\n' "${targets[*]}" "$TEST_EMAIL" "${run#"$repo"/}"
set +e
maestro test "${targets[@]}" \
  -e EXPO_URL="$EXPO_URL" -e TEST_EMAIL="$TEST_EMAIL" -e TEST_PASSWORD="$TEST_PASSWORD" \
  --format junit --output "$run/report.xml" \
  --test-output-dir "$run" --debug-output "$run" 2>&1 | tee "$run/console.log"
code=${PIPESTATUS[0]}
set -e

# The newest run, at a fixed path, for whoever reads the results next.
ln -sfn "$(basename "$run")" "$repo/.smoke-local/maestro/latest"
printf '\n%s  results: %s\n' "$([ "$code" -eq 0 ] && echo '✓ all passed' || echo '✗ failures')" "${run#"$repo"/}"
exit "$code"
