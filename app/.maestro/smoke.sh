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
#   security add-generic-password -s citycrew-maestro-2 -a <second-email> -w
#
# Environment overrides: EXPO_URL (default exp://127.0.0.1:8081 — the
# simulator is on this Mac, so loopback always reaches Metro), TEST_EMAIL,
# TEST_PASSWORD, TEST_EMAIL_2, TEST_PASSWORD_2. Nothing here prints a
# password.
set -euo pipefail

SERVICE=citycrew-maestro
here="$(cd "$(dirname "$0")" && pwd)"
app="$(dirname "$here")"
repo="$(dirname "$app")"
cd "$app"

die() { printf '✗ %s\n' "$*" >&2; exit 1; }

# ── tools ──
command -v maestro >/dev/null || die "maestro not found — see .maestro/README.md, One-time setup."
# Maestro 2 needs Java 17+. A JAVA_HOME left pointing at an older JDK (a
# Java 8 kept for other projects) is replaced for this run only.
java_major() { "$1/bin/java" -version 2>&1 | sed -nE 's/.*version "(1\.)?([0-9]+).*/\2/p' | head -1; }
if [ -n "${JAVA_HOME:-}" ] && [ "$(java_major "$JAVA_HOME")" -lt 17 ] 2>/dev/null; then
  unset JAVA_HOME
fi
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

# ── test accounts ──
# The second is 15-theme's: whose theme a sign-in puts on can only be told
# apart with two accounts. Asked for up front, because a flow handed an
# unset variable types the literal "${TEST_EMAIL_2}" and fails on a
# sign-in error far from the cause.
keychain_account() {
  security find-generic-password -s "$1" 2>/dev/null \
    | sed -n 's/^ *"acct"<blob>="\(.*\)"$/\1/p' || true
}
keychain_password() { security find-generic-password -s "$1" -w 2>/dev/null || true; }
[ -n "${TEST_EMAIL:-}" ] || TEST_EMAIL="$(keychain_account "$SERVICE")"
[ -n "${TEST_PASSWORD:-}" ] || TEST_PASSWORD="$(keychain_password "$SERVICE")"
[ -n "${TEST_EMAIL_2:-}" ] || TEST_EMAIL_2="$(keychain_account "$SERVICE-2")"
[ -n "${TEST_PASSWORD_2:-}" ] || TEST_PASSWORD_2="$(keychain_password "$SERVICE-2")"
[ -n "$TEST_EMAIL" ] && [ -n "$TEST_PASSWORD" ] || die "No test account in the Keychain.
  Add it once:  security add-generic-password -s $SERVICE -a <test-email> -w
  (it prompts for the password, so it never reaches the shell history)"
[ -n "$TEST_EMAIL_2" ] && [ -n "$TEST_PASSWORD_2" ] || die "No second test account in the Keychain (15-theme signs in as both).
  Add it once:  security add-generic-password -s $SERVICE-2 -a <second-email> -w"

# ── run ──
run="$repo/.smoke-local/maestro/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$run"
targets=("$@")
[ ${#targets[@]} -eq 0 ] && targets=(.maestro)

# Only the signup lifecycle needs disposable credentials. Save them before
# Maestro can create the account, so an interrupted run can be recovered.
signup_fixture=""
signup_args=()
for target in "${targets[@]}"; do
  if [ "$(basename "$target")" = "07-sign-up-delete.yaml" ] || [ "$(basename "$target")" = ".maestro" ]; then
    signup_fixture="$(node scripts/maestro-account.mjs prepare "$repo/.smoke-local/signup-accounts")"
    SIGNUP_NAME="$(node -e 'process.stdout.write(require(process.argv[1]).name)' "$signup_fixture")"
    SIGNUP_EMAIL="$(node -e 'process.stdout.write(require(process.argv[1]).email)' "$signup_fixture")"
    SIGNUP_PASSWORD="$(node -e 'process.stdout.write(require(process.argv[1]).password)' "$signup_fixture")"
    signup_args=(-e "SIGNUP_NAME=$SIGNUP_NAME" -e "SIGNUP_EMAIL=$SIGNUP_EMAIL" -e "SIGNUP_PASSWORD=$SIGNUP_PASSWORD")
    break
  fi
done
cleanup_on_exit() {
  status=$?
  trap - EXIT
  if [ -n "$signup_fixture" ]; then
    node scripts/maestro-account.mjs cleanup "$signup_fixture" || status=1
  fi
  exit "$status"
}
trap cleanup_on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

printf '▶ %s as %s and %s → %s\n' "${targets[*]}" "$TEST_EMAIL" "$TEST_EMAIL_2" "${run#"$repo"/}"
set +e
maestro test "${targets[@]}" ${signup_args[@]+"${signup_args[@]}"} \
  -e EXPO_URL="$EXPO_URL" -e TEST_EMAIL="$TEST_EMAIL" -e TEST_PASSWORD="$TEST_PASSWORD" \
  -e TEST_EMAIL_2="$TEST_EMAIL_2" -e TEST_PASSWORD_2="$TEST_PASSWORD_2" \
  --format junit --output "$run/report.xml" \
  --test-output-dir "$run" --debug-output "$run" 2>&1 | tee "$run/console.log"
code=${PIPESTATUS[0]}
set -e
if [ -n "$signup_fixture" ]; then
  node scripts/maestro-account.mjs cleanup "$signup_fixture" || code=1
  signup_fixture=""
fi

# The newest run, at a fixed path, for whoever reads the results next.
ln -sfn "$(basename "$run")" "$repo/.smoke-local/maestro/latest"
printf '\n%s  results: %s\n' "$([ "$code" -eq 0 ] && echo '✓ all passed' || echo '✗ failures')" "${run#"$repo"/}"
exit "$code"
