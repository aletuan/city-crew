# Writing Maestro smoke flows — approach and rules

How the iOS smoke suite is built, and the rules a new flow follows. The
rules are not style: each one is a failure this suite has already had.
Setup, running and reading a failure are in [README.md](README.md).

## What the suite is for

Vitest renders screens in jsdom and checks logic, one screen at a time.
It cannot see the native app: a crash on launch, a tab bar that hides a
button, navigation between tabs, a permission alert, a real Supabase round
trip. The smoke suite drives the real bundle in a simulator and checks
exactly those — **the few paths a reader cannot do without**: launch,
browse, search, sign in, plan and save a trip, save a place.

It is not a second unit-test suite. A flow earns its place only if a
break in that path would stop people using the app. Every flow costs a
minute or more per run; keep the suite short.

## The approach

| Decision | Why |
| --- | --- |
| Expo Go + `openLink` into the dev bundle | No native build needed to run locally. CI will need a dev client instead (see *Later*). |
| Real Supabase data | Catches what fixtures hide — RLS, Edge Functions, auth. The cost: a flow must not assume specific rows. |
| Persistent accounts for existing non-trip flows; disposable accounts for 05/13/16/18/19/20 | Trip tests require isolated run-owned data. Persist cleanup ledgers before signup, preflight email settings, and recover on the next run. |
| Account from the macOS Keychain, via `smoke.sh` | Never typed, never in shell history, never in a flow or commit. |
| Every run's report and screenshots in `.smoke-local/maestro/` | Anyone — or an agent — can read a failure afterwards without re-running it. |

## Rules for a flow

**Selecting**

1. **Select by `testID`, never by label.** Every label is trilingual. The
   only exception is iOS's own alerts, which take no id — match those in
   all three languages: `text: "Delete|Xoá|削除"`. Generated fixture titles
   may be matched as data; they are not translated UI labels. Use a stable
   slug to compare place identity across screens that shorten names differently.
2. **Give a state its own id when the flow must wait on it.** The bookmark
   is `detail-save` / `detail-saved`, so a flow can wait for a save to
   land without reading a label.
3. **Add ids through an optional `testID` prop** on shared components
   (`Chip`, `GradientCta`, `PrimaryButton` already have one). List every
   new id in the README table. `scripts/maestroIds.test.ts` fails CI when a
   flow names an id the source no longer sets.

**State**

4. **Start fresh.** Every flow begins with `common/start.yaml` (kill Expo
   Go, reopen the bundle, land on Explore). Never rely on where the
   previous flow left the app.
5. **Declare the sign-in state you need** with `common/ensure-signed-in.yaml`
   or `common/ensure-signed-out.yaml`, not by assuming it. Sign-in must verify the actual email, not just a Sign out button.
6. **Clean up what you create, and clean up leftovers first.** A run can
   die half way; the next one must still pass. `05` requires an empty disposable account and never sweeps existing trips; `06` unsaves a place a failed run left
   saved.
7. **Need no manual setup.** If the account lacks something, the flow
   makes it (`06` creates its "Maestro smoke" list the first time).

**Moving around the screen**

8. **The tab bar ducks when a page scrolls down.** After scrolling, scroll
   back up (`scrollUntilVisible … direction: UP`) before tapping a tab.
9. **Buttons at the foot of a page:** `scrollUntilVisible`, then one more
   `scroll`, then tap — the first frame it is "visible" in can be under
   the floating tab bar. **Do not** use `centerElement` there: a button
   at the end of the content can never be centred, and the scroll runs
   until the timeout. `centerElement` is for mid-page targets only.
10. **Wait on something, never sleep.** `extendedWaitUntil` with an
    explicit timeout. The first bundle load of a session can take a
    minute — hence 90 s on `tab-explore`.
11. **Grant permissions up front** in `launchApp` (`permissions:
    notifications: allow`); a system alert over the screen breaks every
    step after it.

11a. **After a system alert, relaunch before you open a Modal you
    must read.** Once an `Alert` has been shown in a session, the owner's
    `⋯` menu on a collection page reads to XCUITest as an empty tree —
    on screen, but no ids. Measured on 10 October: fresh session, the
    menu reads; cancel one delete alert and reopen it, and it does not.
    A flow whose cleanup deletes (and so raises the alert) relaunches
    with `common/start.yaml` before going on — see `11`. An alert at the
    very end of a flow is harmless.

**Secrets**

12. **Credentials come in as `-e` variables** (`${TEST_EMAIL}`,
    `${TEST_PASSWORD}`, and `${TEST_EMAIL_2}` / `${TEST_PASSWORD_2}` for
    the second account) and are never written into a flow. Run through
    `npm run smoke:ios`, which passes them from the Keychain — calling
    `npm run` with `-e PASSWORD=…` yourself makes npm echo the password.

## Adding a flow — checklist

When fixing an E2E failure, record each confirmed, reusable finding in
[REVIEW.md](REVIEW.md) as soon as it is established. Include the symptom,
evidence, fix, unsuccessful approaches, validation runs, and any remaining
uncertainty. Update provisional conclusions when later evidence changes
them; do not mark a fix verified before the relevant E2E branch passes.

- [ ] The path is one a reader cannot do without, and vitest cannot cover it.
- [ ] Numbered file (`07-….yaml`), added to `flowsOrder` in `config.yaml`.
- [ ] Starts with `common/start.yaml` and an `ensure-signed-*` subflow.
- [ ] Selects only by `testID`; new ids added in the app and in the README table.
- [ ] Cleans up leftovers first and its own data last.
- [ ] `maestro check-syntax` passes; `npm test` (maestroIds) passes.
- [ ] Green twice in a row locally — the second run proves the cleanup.

## Signup and deletion lifecycle

`07-sign-up-delete.yaml` is automated and included in the suite. Run it
through `smoke.sh`, which creates a unique disposable credential and checks
that email confirmation is OFF before the flow starts. The flow verifies
signup, session persistence, UI deletion, rejected sign-in, and guest state.

Its simulator prep disables Suggest Strong Passwords on the dedicated
English iOS 26 simulator. Select the actual switch to the right of its
label, bounded above and below; tapping the row id does not toggle it.
Keep production AutoFill behavior unchanged. See REVIEW.md for the failed
approaches, keyboard focus and retained Profile scroll-position findings.

Cleanup belongs to the runner as well as the UI test. A failed flow must
not abandon a new account: the runner uses that fixture's own session to
call `delete-account`. A successful UI flow that still needs fallback
cleanup is a failure. Keep the local recovery ledger on uncertain network
results; the next signup run retries it before creating another account.
Do not run concurrent signup runners against the same ledger/simulator.
Never reuse the persistent A/B accounts as disposable signup identities.

## Later

- **Nightly CI.** The repo is public, so macOS runners are free. Needs a
  dev-client build instead of Expo Go, and the test account in GitHub
  Secrets.
- **A staging Supabase project** before CI runs nightly, so tests never
  write to production.
- **Cleanup after abrupt process loss.** EXIT/INT/TERM have cleanup, but
  SIGKILL, power loss and offline servers require the next run's ledger
  recovery. Preserve `.smoke-local/signup-accounts/` until confirmed clean;
  see README.md for the explicit recovery command.
