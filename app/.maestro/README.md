# iOS smoke tests (Maestro)

Four end-to-end flows that drive the dev bundle inside Expo Go on an iOS
simulator and check that the guest-facing path still works against real
Supabase data: launch, Explore, place detail, search. They select by
`testID` only — never by label — because every label is trilingual.

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

`common/dismiss-welcome.yaml` is a subflow every flow runs first, so a fresh
Expo Go and a warm one behave the same. `config.yaml` restricts
`maestro test .maestro` to the numbered flows.

## One-time setup

1. Maestro (needs Java 17+; `brew install openjdk@17` if `java -version` fails):

   ```sh
   curl -Ls "https://get.maestro.mobile.dev" | bash
   maestro --version
   ```

2. Xcode with an iOS simulator runtime, and Expo Go installed on that
   simulator. The first `npx expo start` → press `i` installs Expo Go for you.

## Running

Three terminals, or one with `&`:

```sh
# 1. Boot a simulator (any iPhone works; pick the name from `xcrun simctl list devices available`).
xcrun simctl boot "iPhone 16"
open -a Simulator

# 2. Start the dev server from app/ and note the exp:// URL it prints.
cd app
npx expo start
#   › Metro waiting on exp://192.168.1.23:8081     ← this one

# 3. Run the suite. Pass the URL from step 2; the default is exp://127.0.0.1:8081.
npm run smoke:ios -- -e EXPO_URL=exp://192.168.1.23:8081
```

Open the app in Expo Go once by hand before the first run (press `i` in the
`expo start` terminal). Maestro's `openLink` reuses the running Expo Go and
loads the bundle; the first load of a session can take a minute, which is
why the flows wait up to 90 s for `tab-explore`.

To run one flow:

```sh
maestro test .maestro/02-place-detail.yaml -e EXPO_URL=exp://...
```

## Reading a failure

Maestro prints each step with ✅ / ❌ and stops the flow at the first
failure. The reason is in the line right after the ❌, usually one of:

- `Element not found: Id matching regex: place-card-0` — the selector did
  not appear before the timeout. Either the screen never got there (look at
  the screenshot), or the `testID` was removed or renamed in the component.
- `Assertion is false` — the element exists but is not on screen; scroll
  or wait before the assert.

On failure Maestro writes a screenshot and the view hierarchy to
`~/.maestro/tests/<timestamp>/`. Open the newest folder:

```sh
open "$(ls -td ~/.maestro/tests/*/ | head -1)"
```

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

Renaming one of these is a breaking change for this suite; grep `.maestro/`
before you do.

## Why not CI

- Expo Go needs a simulator, so the job must run on macOS.
- `openLink` into Expo Go depends on a dev server on the same machine; a
  CI job would instead build a dev client (`eas build --profile development`
  or `expo run:ios`) and point Maestro at `com.aletuan.citycrew`.
- The flows read live Supabase data. A CI run should either seed a fixture
  project or accept that a data change can fail the smoke.

When those are in place, the suite itself needs no change beyond `appId`.
