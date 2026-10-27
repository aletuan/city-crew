# iOS smoke tests (Maestro)

End-to-end flows (how to write more: [GUIDELINES.md](GUIDELINES.md)) that
drive the dev bundle inside Expo Go on an iOS simulator against real
Supabase data — the guest path, the paths a signed-in reader cannot do
without, and one that signs up and deletes a throwaway account of its own.
**`config.yaml` is the list of what runs, and its order.** The table below
says what each flow checks; it does not say how many there are, because a
count written here is a count that goes stale — this sentence replaced one
that said eight when the directory held nine.

They select by `testID` only — never by label — because every label is
trilingual. The one exception is iOS's own alert buttons, which take no id
and are matched in all three languages.

**Not wired into CI.** These run on a developer's Mac by hand. Running them
on GitHub would need a macOS runner plus a dev build (Expo Go cannot be
scripted from a Linux job). See "Why not CI" at the end.

## What runs

| Flow | Checks |
| --- | --- |
| `00-launch.yaml` | Opens the `exp://` URL in Expo Go, dismisses the welcome sheet, sees the Explore tab. |
| `01-explore.yaml` | First place card renders, list scrolls down and back up, city switcher opens, another city is chosen, default city restored. |
| `02-place-detail.yaml` | Opens the first card, asserts name and hero photo, scrolls to the address below variable-length content, then returns to the top and back to Explore. |
| `03-search.yaml` | Opens search, types `cafe`, opens the first hit, comes back, clears the query. |
| `04-sign-in.yaml` | Signs out if needed; a wrong password shows the form error; the right one signs in and lands on Explore (nothing was waiting on the sign-in — see `leaveAuth`); a cold start is still signed in; signs out. |
| `05-plan-trip.yaml` | Requires an empty run-owned disposable account; answers the Ideas wizard (Friends + up to three moods); waits out Sketching; opens the recommended plan; saves it; finds it as the only upcoming trip in that account; deletes it. |
| `06-save-place.yaml` | Opens the first place on Explore; saves it — into the first collection, or into a new "Maestro smoke" list if the account has none — and waits for the bookmark to fill; takes it out again; signs out. |
| `07-sign-up-delete.yaml` | Creates a unique runner-generated disposable account with email confirmation OFF; skips taste onboarding; verifies the signed-in session after a cold start; checks the fixture name on Delete account; deletes through the UI; signing in again must fail, and a cold start stays signed out. The runner retries leftover cleanup and performs a final backend check. See Signup lifecycle below for simulator setup and failure recovery. |
| `08-explore-filter.yaml` | Pins the location to Hanoi; sorts Explore by distance, then adds "open now"; the filter button's count shows both; Reset clears them and the list is back. The map toggle is not covered — Expo Go on iOS draws no map. |
| `09-collections-browse.yaml` | As a guest: the Collections tab's first community card opens; the detail menu selects Grid explicitly; the first tile opens its place; Back walks place → collection → list. Community cards share an id across layouts; detail tiles use `collection-tile-*`, while detail list cards use `collection-place-*`. |
| `10-check-in.yaml` | Opens the first place on Explore; takes back any visit a failed run left there; checks in and waits for the pill to read back the visit from the server; opens the visit sheet and removes it; the pill is bare again. Needs the `place_checkin` flag on. |
| `11-collection-crud.yaml` | Deletes any "Maestro CRUD…" list a failed run left; creates "Maestro CRUD"; renames it "Maestro CRUD 2" from its menu; reopens the app after renaming so iOS exposes the Save sheet to Maestro; saves the first Explore place into it; selects Grid and opens its first tile; takes the place out and deletes the list. Matches the populated card's title with its visibility suffix. Leaves 06's "Maestro smoke" alone. |
| `13-trip-edit.yaml` | Requires an empty run-owned disposable account; plans as 05 does; in the editor reads the first stop's hour, moves it 15 minutes earlier and sees it change; saves; dismisses the optional native review prompt and scrolls to the first stop; the saved trip shows the edited hour — and still does after a cold start; deletes the trip. Saved trips have no editor, so the edit is the plan's, before Save. |
| `14-forgot-password.yaml` | As a guest: Sign in → Forgot password → asks for a code for `maestro-reset@example.com` (a reserved domain: no account, no mail sent — never the test account, whose address is a real mailbox) → reaches the code step with the resend link waiting → Reset with no code is refused by the form and stays put. Does not reach the server refusing a wrong code: that needs the new-password field, which raises iOS's "Use Strong Password?" panel. |
| `15-theme.yaml` | Two accounts. Signed in as A: Profile → Theme → Dark, the tick lands on it; signs out; as a guest picks Light; A signs back in and the sheet ticks Dark again, read from the account; B signs in on the phone A left on Dark and gets its own Light; A after B is Dark again; sets Auto; signs out. Grounds only — a look restarts the app, which Expo Go cannot do. Reads ticks in the row's label, never colours. |
| `16-trip-invite.yaml` | Uses two disposable accounts with a verified friendship. A invites B; B accepts and has Leave, not Delete. A sees Coming and deletes; cold starts of both accounts verify empty, freshly loaded trip lists. A second trip checks B accepting then leaving, persistence after restart, and A seeing Can’t make it while retaining ownership; A deletes that trip. |
| `17-unfriend.yaml` | Two accounts. A: Profile → Connect with friends → Your friends → long-press B's row (`crew-friend-0`; the ⋯ beside it is not in the iOS accessibility tree) → Unfriend → the alert's Unfriend; B is off the list. A asks again by B's username (`B_HANDLE` in the flow) → Send request; the SENT row appears (`crew-sent-0`). B signs in → Requests → Accept (`crew-accept-0`); A is on B's list. Restores the persistent friendship fixture, and starts from either state. |
| `12-language.yaml` | As a guest: Profile → Language → Tiếng Việt, the Places tab reads "Địa điểm", the first place opens and draws; the same in 日本語 ("スポット"); back to English. The only flow that asserts labels. Runs last — the choice persists on the device. |

The signed-in flows share `common/start.yaml` (open fresh, grant
notifications — saving a trip plants a reminder, and the permission alert
would stand over Trips), `common/ensure-signed-in.yaml`,
`common/ensure-signed-out.yaml`, `common/sign-in.yaml`,
`common/delete-first-trip.yaml` (waits for detail to close and `trips-ready` after the server refresh), `common/open-save-sheet.yaml` (the
bookmark, in either state) and `common/delete-open-collection.yaml`
(the open collection's menu → Delete → the system alert),
`common/pick-language.yaml` (Profile → Language → `${LANG_ID}`),
`common/pick-theme.yaml` (Profile → Theme → `${THEME_ID}`, the tick, close),
`common/open-crew.yaml` (Profile → Connect with friends, by the row's text),
`common/expect-theme.yaml` (the same sheet, the tick already on `${THEME_ID}`, close without choosing) and
`common/open-first-place.yaml` (first Places card → its page → back). Trip flows never sweep pre-existing trips: they require empty disposable accounts and delete only their sole created trip. Other flows retain their documented fixture cleanup.

`common/dismiss-review.yaml` closes the optional Apple review prompt with
"Not Now" on the English smoke simulator after a save.

`common/dismiss-welcome.yaml` and `common/expo-go-prep.yaml` are subflows
every flow runs first, so a fresh Expo Go and a warm one behave the same.
The second one switches off Expo Go's floating "Tools button" — the blue
gear docks at the top-right corner, exactly over Explore's search button,
and a tap there opens Expo's dev menu instead of Search. Expo Go remembers
the setting, so after the first run those steps are no-ops. Expo Go 57's
menu slides up a beat late and keeps the switch at the foot of its TOOLS
list, so the subflow waits for the menu and scrolls to the row; it only
runs while the gear is showing, so it can never switch the button back on.
After scrolling, it waits for the menu to settle and targets the switch
below **Fast refresh**, to the right of **Tools button**: `rightOf` alone
can also match Fast refresh's switch. It verifies the Tools button's OFF
value before Reload, then checks that the floating gear is gone. `config.yaml`
restricts `maestro test .maestro` to the numbered flows and fixes their order.

## One-time setup

1. Maestro (needs Java 17+; `brew install openjdk@17` if `java -version` fails —
   `smoke.sh` ignores a `JAVA_HOME` older than 17 and picks one with `java_home -v 17+`):

   ```sh
   curl -Ls "https://get.maestro.mobile.dev" | bash
   maestro --version
   ```

2. Xcode with an iOS simulator runtime, and Expo Go installed on that
   simulator. The first `npx expo start` → press `i` installs Expo Go for you.

3. **A test account, used for nothing else.** Flows such as 04, 06, 10, and 11 sign in as it. Trip flows 05, 13, and 16 use separate disposable accounts. Once:

   - Sign up in the app with an address you control (a `+maestro` alias
     of your own works, e.g. `you+maestro@gmail.com`) (email confirmation is currently disabled).
   - No collection is needed: flow 06 makes one ("Maestro smoke") the
     first time, through the form the bookmark opens, and reuses it.
   - Keep it off the editors list.

   `07-sign-up-delete.yaml` makes and deletes its own throwaway account.
   It never deletes either persistent test account.

   Then put it in the macOS Keychain — the runner reads it from there, so
   it is never typed per run, never in the shell history, and never in a
   flow or a commit:

   ```sh
   security add-generic-password -s citycrew-maestro -a you+maestro@gmail.com -w
   # prompts for the password; to change it later add -U to the same command
   ```

   **A second account** for `15-theme`, which checks that a sign-in puts
   on the account's theme and not the last person's on the phone — and
   "the last person" has to be another account for that to show. Make it
   the same way (another alias: `you+maestro+theme-b@gmail.com`), sign in
   as it once and set Theme → **Light**, and leave it there: the flow
   never changes B's theme, and reads Light back as proof nothing leaked
   into it. Then:

   ```sh
   security add-generic-password -s citycrew-maestro-2 -a you+maestro+theme-b@gmail.com -w
   ```

   `smoke.sh` refuses to start without it. If B ever reads Dark, a run
   stopped while signed in as B, or the app leaked A's theme; set B back
   to Light by hand before the next run.

   `17-unfriend` still uses persistent A/B and its configured `B_HANDLE`.
   Its friend fixture is independent of the disposable trip accounts.

## Trip fixtures and identity checks

Run 05, 13, and 16 through `smoke.sh`. The runner provisions a fresh pair of
`maestro-e2e-<UUID>@example.com` accounts and establishes their friendship
using A's request and B's acceptance under normal RLS. It verifies the edge
before launching Maestro. `TRIP_EMAIL`, `TRIP_PASSWORD`, `TRIP_EMAIL_2`, and
`TRIP_PASSWORD_2` are injected only for these flows (or the full suite).
Signup requires email confirmation OFF. Persistent A/B are not used for trips.

`ensure-signed-in` always signs out and signs in with the requested credentials.
`sign-in` reads `profile-email` and compares the actual session's email before
returning. Every trip flow asserts a freshly loaded empty baseline instead
of deleting whatever happens to be there. A nonempty baseline fails the flow.
The single-card selector is only used after this isolation and baseline check.

Credentials are saved with mode 0600 beneath `.smoke-local/trip-accounts/a/`
and `b/` before signup. The runner deletes both generated accounts at exit,
including their owned test data via backend cascades. Failed cleanup retains
the records and fails the run; the next trip run retries them. This is fixture
teardown, not proof of UI deletion: the flows assert UI deletion separately.

Only one trip runner may hold `.smoke-local/trip-accounts.lock`. After SIGKILL
or power loss, first confirm no runner is active, remove the stale empty lock
directory, and rerun. Do not remove credential records. To recover explicitly:

```sh
node scripts/maestro-trip-fixtures.mjs cleanup ../.smoke-local/trip-accounts
```


## Signup lifecycle

Run `npm run smoke:ios -- .maestro/07-sign-up-delete.yaml` through the runner,
not raw `maestro test`: it supplies `SIGNUP_NAME`, `SIGNUP_EMAIL`, and
`SIGNUP_PASSWORD`. Email confirmation must be OFF; a settings preflight
fails before creating anything if `mailer_autoconfirm` is not true.

On the dedicated **English iOS 26 simulator**, `common/signup-ios-prep.yaml`
opens Settings → General → AutoFill & Passwords and disables **Suggest
Strong Passwords**, leaving ordinary AutoFill enabled. This simulator-only
setting persists. The app's real password/AutoFill behavior is unchanged.
The helper supports Settings home, General, or the AutoFill page; return to
Settings home first if this simulator was left on another settings page.

The runner writes a unique `maestro-e2e-<UUID>@example.com` fixture to
`.smoke-local/signup-accounts/` with file mode 0600 before registration.
At exit it authenticates only that fixture and calls the same own-account
`delete-account` function if needed. Recovery after a supposedly successful
UI flow makes the run fail, so cleanup cannot hide broken UI deletion.
Offline/rate-limited/unknown results retain the ledger and fail the run;
the next signup run retries pending records before creating another account.
SIGKILL/power loss cannot run a trap, so do not delete pending ledger files.
No service-role key is used. To retry one pending cleanup explicitly from app/:

```sh
node scripts/maestro-account.mjs cleanup ../.smoke-local/signup-accounts/<uuid>.json
```

Exit 0 means credentials are rejected; exit 2 means a survivor was deleted
and verified; exit 1 means recovery still needs attention. Keep passwords,
tokens, and raw ledger contents out of commits and reports.

## Running

Two terminals:

```sh
# 1. Boot a simulator and start Metro from app/ (leave it running).
xcrun simctl list devices booted  # boot one if empty: xcrun simctl boot "<name>"
open -a Simulator
cd app && npx expo start          # press i once to open the app in Expo Go

# 2. Run the suite from app/.
npm run smoke:ios                                   # every flow config.yaml lists
npm run smoke:ios -- .maestro/05-plan-trip.yaml     # one flow
```

`npm run smoke:ios` is `.maestro/smoke.sh`. It checks that Maestro, Java and
Metro are there, reads the account from the Keychain, and runs Maestro with
a JUnit report and full debug output. Every run lands in its own folder,
with `latest` pointing at the newest:

```
.smoke-local/maestro/20260911-193000/   (latest →)
  report.xml     pass/fail per flow, with the failing step's message
  console.log    what the terminal showed
  <flow>/...     commands log, screenshots and view hierarchy per flow
```

`.smoke-local/` is git-ignored. `EXPO_URL`, `TEST_EMAIL` and
`TEST_PASSWORD` in the environment override the defaults
(`exp://127.0.0.1:8081` — the simulator is on this Mac, so loopback always
reaches Metro — and the Keychain entry).

Open the app in Expo Go once by hand before the first run (press `i` in the
`expo start` terminal). Each flow then kills Expo Go (`launchApp` with
`stopApp: true`) and reopens the bundle through `openLink`, so it starts on
Explore regardless of where the previous flow left the app. The first load
of a session can take a minute, which is why the flows wait up to 90 s for
`tab-explore`.

If more than one simulator is booted, Maestro may pick either; pass
`--device <UDID>` (from `xcrun simctl list devices booted`) to pin one.

## Reading a failure

See [REVIEW.md](REVIEW.md) for the Vietnamese troubleshooting review:
confirmed causes, fixes, unsuccessful approaches, and regression evidence
from the 27 October 2026 simulator runs.

Maestro prints each step with ✅ / ❌ and stops the flow at the first
failure. The reason is in the line right after the ❌, usually one of:

- `Element not found: Id matching regex: place-card-0` — the selector did
  not appear before the timeout. Either the screen never got there (look at
  the screenshot), or the `testID` was removed or renamed in the component.
- `Assertion is false` — the element exists but is not on screen; scroll
  or wait before the assert.

On failure the runner's folder holds a screenshot and the view hierarchy
at the failing step. Open the newest:

```sh
open ../.smoke-local/maestro/latest      # from app/
```

The hierarchy is the quickest answer to "was it there?" — it lists every
`id` on screen at that moment — and the screenshot answers the follow-up,
"what was in the way?". Most failures in this suite's history were one of
three things: a hidden tab bar, a button under it, or missing account
data. Check those before anything cleverer.

`maestro studio` opens an inspector on the running simulator and shows every
element's `id`, which is the fastest way to check a `testID` actually
reaches the native view.

## testIDs the flows depend on

| Component | testID |
| --- | --- |
| `FloatingTabBar` | `tab-ideas`, `tab-explore`, `tab-trips`, `tab-collections`, `tab-profile` |
| `WelcomeSheet` | `welcome-dismiss` |
| `ExploreScreen` | `explore-search`, `explore-city`, `explore-list`, `place-card-<index>` |
| `ExploreScreen` (filter) | `explore-filter` / `explore-filter-pinned` (its label carries the applied count as a digit — the badge inside it has no id of its own on iOS), `explore-view` (map toggle — dev build only) |
| `ExploreFilterSheet` | `filter-sort-<recommended\|distance\|rating>`, `filter-status-<any\|open\|closed>`, `filter-saved`, `filter-reset` (only when dirty), `filter-apply`, `filter-close` |
| `CitySwitcher` | `city-search`, `city-row-<index>` (the A–Z list), `city-recent-<index>` (the recent section, when shown) |
| `PlaceDetailScreen` | `detail-name`, `detail-address`, `detail-photo`, `detail-back` |
| `SearchScreen` | `search-input`, `search-cancel`, `search-result-<index>` |
| `ProfileScreen` | `profile-sign-in` (guest), `profile-sign-out` (signed in), `profile-delete-account`, `profile-language`, `profile-email` (actual signed-in email) |
| `LanguageSwitcher` | `lang-<en\|vi\|ja\|zh>` |
| `SignInScreen` | `signin-email`, `signin-password`, `signin-submit`, `signin-switch-signup` (`SwitchRow`), `signin-forgot`; `auth-error` (`FormError`) |
| `ForgotPasswordScreen` | `forgot-email`, `forgot-submit`; on the code step `forgot-code`, `forgot-resend`, `forgot-reset` (`forgot-password` is set but no flow types into it — see `14`'s header) |
| `SignUpScreen` | `signup-name`, `signup-email`, `signup-password`, `signup-confirm`, `signup-submit`, `signup-taste-skip`, `signup-welcome-continue` |
| `DeleteAccountScreen` | `delete-account-confirm` (`DangerButton`) |
| `IdeasScreen` | `ideas-company-<solo\|couple\|friends\|family>`, `ideas-cat-<index>`, `ideas-sketch` |
| `PlanOptionsScreen` | `plan-card-best` |
| `PlanEditScreen` | `plan-save`, `plan-stop-time-<index>`, `plan-stop-earlier-<index>` (the −15 min step) |
| `TripsScreen` | `trip-upcoming-<index>`, `trips-ready` (trips and invitations loaded without error/cache fallback), `trips-empty` (no owned/accepted trips or invitations) |
| `TripDetailScreen` | `trip-delete` (owner), `trip-leave` (invitee), `trip-stop-time-<index>` |
| `PlaceDetailScreen` | `detail-save` / `detail-saved` — one id per state |
| `PlaceDetailScreen` (check-in) | `detail-checkin` / `detail-checked-in` — one id per state; in the visit sheet `checkin-head`, `checkin-visit` (each row), `checkin-visit-remove` (each row's trash), `detail-checkin-again` |
| `SaveSheet` | `save-row-<index>`, `save-done` |
| `CollectionFormScreen` | `collection-name`, `collection-submit` |
| `CollectionsScreen` | `collection-card-<index>` (community; same index in grid and rows), `collections-yours` (the Yours tab, signed in), `collection-new` (the New pill in the header: on Yours once there is a list, on Community always when signed in) |
| `CollectionDetailScreen` | `collection-place-<index>` (List), `collection-tile-<index>` (Grid), `collection-menu-grid`, `collection-back`, `collection-more`, `collection-menu-edit`, `collection-menu-delete` |
| `CrewScreen` | `crew-sent-<index>` (outgoing request), `crew-friend-<index>`, `crew-accept-<index>` |

Renaming one of these is a breaking change for this suite, and
`scripts/maestroIds.test.ts` fails in CI when a flow names an id the
source no longer sets. Grep `.maestro/`
before you do.

## Why not CI

- Expo Go needs a simulator, so the job must run on macOS.
- `openLink` into Expo Go depends on a dev server on the same machine; a
  CI job would instead build a dev client (`eas build --profile development`
  or `expo run:ios`) and point Maestro at `com.aletuan.citycrew`.
- The flows read live Supabase data. A CI run should either seed a fixture
  project or accept that a data change can fail the smoke.

When those are in place, the suite itself needs no change beyond `appId`.
