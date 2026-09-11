# Writing Maestro smoke flows — approach and rules

How the iOS smoke suite is built, and the rules a new flow follows. The
rules are not style: each one is a failure this suite has already had.
Setup and running are in [README.md](README.md).

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
| One persistent test account for signed-in flows | Fast and stable. Creating an account per run hits signup rate limits, breaks when email confirmation is on, and leaves orphans when a run dies. |
| Account from the macOS Keychain, via `smoke.sh` | Never typed, never in shell history, never in a flow or commit. |
| Every run's report and screenshots in `.smoke-local/maestro/` | Anyone — or an agent — can read a failure afterwards without re-running it. |

## Rules for a flow

**Selecting**

1. **Select by `testID`, never by label.** Every label is trilingual. The
   only exception is iOS's own alerts, which take no id — match those in
   all three languages: `text: "Delete|Xoá|削除"`.
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
   or `common/ensure-signed-out.yaml`, not by assuming it.
6. **Clean up what you create, and clean up leftovers first.** A run can
   die half way; the next one must still pass. `05` deletes leftover
   upcoming trips before planning; `06` unsaves a place a failed run left
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

**Secrets**

12. **Credentials come in as `-e` variables** (`${TEST_EMAIL}`,
    `${TEST_PASSWORD}`) and are never written into a flow. Run through
    `npm run smoke:ios`, which passes them from the Keychain — calling
    `npm run` with `-e PASSWORD=…` yourself makes npm echo the password.

## Adding a flow — checklist

- [ ] The path is one a reader cannot do without, and vitest cannot cover it.
- [ ] Numbered file (`07-….yaml`), added to `flowsOrder` in `config.yaml`.
- [ ] Starts with `common/start.yaml` and an `ensure-signed-*` subflow.
- [ ] Selects only by `testID`; new ids added in the app and in the README table.
- [ ] Cleans up leftovers first and its own data last.
- [ ] `maestro check-syntax` passes; `npm test` (maestroIds) passes.
- [ ] Green twice in a row locally — the second run proves the cleanup.

## Reading a failure

`npm run smoke:ios` prints `[Passed]` / `[Failed]` per flow and writes
`.smoke-local/maestro/latest/`: `report.xml`, `console.log`, and per flow
the commands log, a screenshot and the view hierarchy at the failing step.
The hierarchy answers "was the id on screen?"; the screenshot answers
"what was in the way?". Most failures in this suite's history were a
hidden tab bar, a button under it, or missing account data — check those
first.

## Manual QA

One path has no automated coverage: signing up a new account and deleting
it (App Store 5.1.1(v)). `07-sign-up-delete.yaml` documents the steps, but
iOS's own "Use Strong Password?" panel on the password field is a
separate process from the app and Maestro/XCUITest cannot see or interact
with it — see the flow's own header for what was tried. Before each
release, do this by hand once:

- [ ] Sign up with a throwaway email and a real typed password.
- [ ] Confirm the account lands on the taste picker, then Profile, signed in.
- [ ] Profile → Delete account → confirm. Confirm it falls back to the
      guest view with no separate sign-out step.

## Later

- **Nightly CI.** The repo is public, so macOS runners are free. Needs a
  dev-client build instead of Expo Go, and the test account in GitHub
  Secrets.
- **A staging Supabase project** before CI runs nightly, so tests never
  write to production.
- **A sweep for orphans.** `07-sign-up-delete` (done) deletes the account it
  makes at the end of the same run, but a run that dies between sign-up and
  delete leaves one behind. It was sketched as a `+mae-<time>` alias of a
  real address so a sweep could find them by pattern; it shipped as
  Maestro's own `inputRandomPersonName` / `inputRandomEmail` instead — no
  scripting needed to build the string, at the cost of orphans not being
  greppable by a shared tag. Revisit if orphans turn out to matter enough
  to write the sweep: either tag the address after all, or query auth.users
  for accounts with no rows anywhere else and an old `created_at`.
- **`07-sign-up-delete` running unattended again.** It is correct today,
  just not runnable — the app never sees the "Use Strong Password?" panel,
  so there is nothing in the app to fix. Two ways back in, neither tried
  yet: turn AutoFill password suggestions off for the smoke simulator only
  (Settings → Passwords → Password Options), so real users on their own
  devices are unaffected; or wait for Maestro to add a way to interact
  with system-owned panels on iOS.
