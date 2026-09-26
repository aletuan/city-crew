# City Crew — what a session needs in its first five minutes

This file exists because everything below used to be rediscovered, every
time, by reading CI config and grepping `package.json`. The cost was not
the reading: it was the mistakes made before the reading happened — a
coverage floor found by turning CI red, a channel model found by two wrong
diagnoses, a squash-merged branch pushed with a SHA that was guessed.

Everything here is a fact about this repository, not a preference. The
reasoning behind a decision lives beside the code that makes it; this is
only the map.

## The four workspaces

| | what it is |
|---|---|
| `app/` | The product. Expo / React Native, TypeScript. Almost all work happens here. |
| `supabase/` | Migrations, Edge Functions, RLS. |
| `dashboard/` | The data desk: a small web app for curating the catalog. |
| `data/` | Seeds, review scripts, and frozen bootstrap pipelines kept for provenance. |

The 4.2 MB `citycrew-mockup-dark.html` that used to sit at the root is
gone (cc5d64f is the last commit holding it), along with its whole
pipeline: the Sync button, the `sync-mockup` workflow and Edge Function,
`inject-mockup.mjs`, and the ES5 `itinerary-runtime.js` it was built
from. It had not been re-synced since 8 August and was serving three
places from one city, publicly, on every dashboard deploy. The app is
the demo now.

## Before you push: the gates, in full

CI (`.github/workflows/checks.yml`) runs five jobs. The `app` job is four
of the five gates and the one that fails:

```bash
cd app
npm run typecheck        # tsc --noEmit
npm run lint             # eslint . --max-warnings=0 — no third state
npm test                 # vitest run
npm run test:tz          # the same suite on a clock with daylight saving
npm run coverage         # the same suite again, with floors
```

Run all five locally before pushing. One validated push beats three
speculative ones, and a red PR costs a cycle of the reviewer's trust.

**The coverage floors are per file, not on average** (`app/vitest.config.ts`):

| scope | floor |
|---|---|
| `src/lib/**/*.ts` | **100** on statements, branches, functions and lines |
| `src/screens/*.tsx` | 96 lines / 96 statements / 90 branches / 81 functions |
| `src/components/*.tsx` | 94 lines / 94 statements / 92 branches / 90 functions |

The screens and components floors are a ratchet: when a file's coverage
goes up, raise the floor by hand in the same change. They are the figures
the weakest file stood at, so removing a covered line can drop a file
under the floor without any behaviour changing — that has happened.

The other jobs: `bundle` (`npx expo export`), `dashboard`, `data`, and
`migrations`, which runs `supabase/tests/run.sh` against a throwaway
Postgres.

## How work ships

```
branch → draft PR → CI green → squash merge → EAS Update publishes itself
```

`app-preview.yml` publishes an EAS Update on every merge that touches
`app/`. Nothing else has to be done to deploy a JavaScript change.

A binary is different and deliberate: **Actions → Release app to
TestFlight**, with a `profile` input. `--no-wait`, so a green job means
"EAS accepted the job", never "there is a build in TestFlight". Watch the
build page *and* the Submissions page; they fail separately.

### Two git rules, both learned the hard way

**Merges are squashes, so a branch tip is never an ancestor of `main`.**
After a merge, reset the branch rather than building on it:

```bash
git fetch origin main && git checkout -B <branch> origin/main
```

**Never abbreviate or reconstruct a SHA.** `git rev-parse HEAD` first,
every time, and pass the full 40 characters to `--force-with-lease` and
to any merge that takes an expected head. A guessed SHA produces a 409
that reads like a race and is not one.

## Supabase

Project ref **`amdvitzpogaejzzqroco`** (`citycrew-data`, ap-southeast-1).

**CI tests migrations; nothing applies them to the live project.** A
migration committed and merged is not a migration that has run. Apply it
yourself, and check that the repo still describes the schema — a merge
has silently dropped an applied migration from the tree before.

## The EAS channel, and what it decides

A channel is stamped into a binary at build time and never changes.
`app/eas.json` maps profile → channel, and `app/src/lib/channel.ts` reads
it back.

| profile | channel | diagnostics |
|---|---|---|
| `development` | `development` | on — but `__DEV__`, so every millisecond it reports is wrong |
| `preview` | `preview` | **on** — a release binary that is allowed to say what it saw |
| `production` | `production` | **off** |

**TestFlight does not decide the channel — the build profile does.** A
TestFlight build made from the `production` profile is a production
build and records nothing.

**`app/src/lib/legal.ts` is binding.** It promises, in a policy a reader
can open: *"The App Store build sends no diagnostics or usage analytics
of any kind."* Anything that turns diagnostics on for a production build
must change that file in the same commit. A test enforces it
(`decktrace.test.ts › is silent on the build the policy says is silent`).

Apple keeps a pre-release train per `version`, and approving a version on
the App Store closes it: bump `version` in `app/app.json` after every
release, or the next submission is refused whatever its build number.

## How this codebase writes

Read a few files before writing one. The convention is unusual and it is
the point:

- **Comments carry the reasoning, not the mechanics.** What the line does
  is visible; why it is that number is not. `SketchingScreen.tsx` is 40%
  comment and none of it restates the code.
- **Numbers are measured, not chosen** — and the measurement goes in the
  comment beside them. A session once spent four rounds tuning a decode
  gap that measurement showed did not exist.
- **Rejected alternatives stay written down**, with what ruled them out.
- **A test that a mutant passes is not a test.** Check new assertions
  against a deliberately broken implementation before trusting them.

## Where the rest is written

| | |
|---|---|
| `docs/tracing.md` | Measuring on a real device: the two trace tables, a measuring session, and the diagnosis order for an empty table. |
| `docs/store/listing.md` | App Store copy in three languages, and the catalog figures to re-check before each submission. |
| `app/README.md` | Running the app, the three ways onto a phone, and the Google Maps keys. |
| `docs/testing/e2e-simulator.md` | The Maestro suite on the iOS simulator: what it checks, and the environment failures already hit. Setup is `app/.maestro/README.md`; how to write a flow is `app/.maestro/GUIDELINES.md`. |
| `docs/tech-eval-app-store.md` | The open items nobody links to: the Google Places cache that outlives what the Maps Platform ToS allows (C1), and the attribution still missing (C3). Read it before touching `import-place.ts` or photo display. |
| `docs/place-naming.md`, `docs/planner-origin-distance.md`, `docs/threads-handles.md` | One question each, answered specifically. |
| `docs/history/` | Plans and specs for work that already shipped. Provenance, not instructions. |
