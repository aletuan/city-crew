# iOS smoke tests (Maestro)

Eight end-to-end flows (how to write more: [GUIDELINES.md](GUIDELINES.md)) that drive the dev bundle inside Expo Go on an iOS
simulator against real Supabase data. Four walk the guest path (launch,
Explore, place detail, search); three sign in as a dedicated test account
and walk the paths a signed-in reader cannot do without (sign in, plan and
save a trip, save a place); one signs up and deletes a throwaway account
of its own. They select by `testID` only — never by label — because every
label is trilingual. The one exception is iOS's own alert buttons, which
take no id and are matched in all three languages.

**Not wired into CI.** These run on a developer's Mac by hand. Running them
on GitHub would need a macOS runner plus a dev build (Expo Go cannot be
scripted from a Linux job). See "Why not CI" at the end.

## What runs

| Flow | Checks |
| --- | --- |
| `00-launch.yaml` | Opens the `exp://` URL in Expo Go, dismisses the welcome sheet, sees the Explore tab. |
| `01-explore.yaml` | First place card renders, list scrolls down and back up, city switcher opens, another city is chosen, default city restored. |
| `02-place-detail.yaml` | Opens the first card, asserts name, address and hero photo, goes back to Explore. |
| `03-search.yaml` | Opens search, types `cafe`, opens the first hit, comes back, clears the query. |
| `04-sign-in.yaml` | Signs out if needed; a wrong password shows the form error; the right one signs in; a cold start is still signed in; signs out. |
| `05-plan-trip.yaml` | Deletes the account's leftover upcoming trips; answers the Ideas wizard (Friends + up to three moods); waits out Sketching; opens the recommended plan; saves it; finds it as the only upcoming trip; deletes it. |
| `06-save-place.yaml` | Opens the first place on Explore; saves it — into the first collection, or into a new "Maestro smoke" list if the account has none — and waits for the bookmark to fill; takes it out again; signs out. |
| `07-sign-up-delete.yaml` | **Not run by `npm run smoke:ios`** — see GUIDELINES.md ("Manual QA"). Documents signing up a brand-new account (a random name and email, Maestro's own generators — never `${TEST_EMAIL}`), skipping the taste picker, then deleting that same account from Profile → Delete account, ending back on the guest view; iOS's own "Use Strong Password?" panel on the password field can't be driven by Maestro, so this path is checked by hand once per release instead. |

The signed-in flows share `common/start.yaml` (open fresh, grant
notifications — saving a trip plants a reminder, and the permission alert
would stand over Trips), `common/ensure-signed-in.yaml`,
`common/ensure-signed-out.yaml`, `common/sign-in.yaml` and
`common/delete-first-trip.yaml`. Every flow cleans up what it made, and
cleans up what a failed earlier run left, before it starts.

`common/dismiss-welcome.yaml` and `common/expo-go-prep.yaml` are subflows
every flow runs first, so a fresh Expo Go and a warm one behave the same.
The second one switches off Expo Go's floating "Tools button" — the blue
gear docks at the top-right corner, exactly over Explore's search button,
and a tap there opens Expo's dev menu instead of Search. Expo Go remembers
the setting, so after the first run those steps are no-ops. `config.yaml`
restricts `maestro test .maestro` to the numbered flows and fixes their order.

## One-time setup

1. Maestro (needs Java 17+; `brew install openjdk@17` if `java -version` fails):

   ```sh
   curl -Ls "https://get.maestro.mobile.dev" | bash
   maestro --version
   ```

2. Xcode with an iOS simulator runtime, and Expo Go installed on that
   simulator. The first `npx expo start` → press `i` installs Expo Go for you.

3. **A test account, used for nothing else.** Flows 04–06 sign in as it,
   and 05 deletes every upcoming trip it owns. Once:

   - Sign up in the app with an address you control (a `+maestro` alias
     of your own works, e.g. `you+maestro@gmail.com`) and confirm the email.
   - No collection is needed: flow 06 makes one ("Maestro smoke") the
     first time, through the form the bookmark opens, and reuses it.
   - Keep it off the editors list.

   `07-sign-up-delete.yaml` needs none of this — it makes and deletes its
   own throwaway account every run, and never touches this one — but it
   isn't run by `npm run smoke:ios` (see GUIDELINES.md).

   Then put it in the macOS Keychain — the runner reads it from there, so
   it is never typed per run, never in the shell history, and never in a
   flow or a commit:

   ```sh
   security add-generic-password -s citycrew-maestro -a you+maestro@gmail.com -w
   # prompts for the password; to change it later add -U to the same command
   ```

## Running

Two terminals:

```sh
# 1. Boot a simulator and start Metro from app/ (leave it running).
xcrun simctl boot "iPhone 16"; open -a Simulator
cd app && npx expo start          # press i once to open the app in Expo Go

# 2. Run the suite from app/.
npm run smoke:ios                                   # all seven flows
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

The hierarchy is the quickest answer to "was it there?": it lists every
`id` on screen at that moment.

`maestro studio` opens an inspector on the running simulator and shows every
element's `id`, which is the fastest way to check a `testID` actually
reaches the native view.

## testIDs the flows depend on

| Component | testID |
| --- | --- |
| `FloatingTabBar` | `tab-ideas`, `tab-explore`, `tab-trips`, `tab-collections`, `tab-profile` |
| `WelcomeSheet` | `welcome-dismiss` |
| `ExploreScreen` | `explore-search`, `explore-city`, `explore-list`, `place-card-<index>` |
| `CitySwitcher` | `city-row-<index>` |
| `PlaceDetailScreen` | `detail-name`, `detail-address`, `detail-photo`, `detail-back` |
| `SearchScreen` | `search-input`, `search-clear`, `search-result-<index>` |
| `ProfileScreen` | `profile-sign-in` (guest), `profile-sign-out` (signed in), `profile-delete-account` |
| `SignInScreen` | `signin-email`, `signin-password`, `signin-submit`, `signin-switch-signup` (`SwitchRow`); `auth-error` (`FormError`) |
| `SignUpScreen` | `signup-name`, `signup-email`, `signup-password`, `signup-confirm`, `signup-submit`, `signup-taste-skip`, `signup-welcome-continue` |
| `DeleteAccountScreen` | `delete-account-confirm` (`DangerButton`) |
| `IdeasScreen` | `ideas-company-<solo\|couple\|friends\|family>`, `ideas-cat-<index>`, `ideas-sketch` |
| `PlanOptionsScreen` | `plan-card-best` |
| `PlanEditScreen` | `plan-save` |
| `TripsScreen` | `trip-upcoming-<index>` |
| `TripDetailScreen` | `trip-delete` (owner), `trip-leave` (invitee) |
| `PlaceDetailScreen` | `detail-save` / `detail-saved` — one id per state |
| `SaveSheet` | `save-row-<index>`, `save-done` |
| `CollectionFormScreen` | `collection-name`, `collection-submit` |

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
