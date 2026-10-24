---
name: release-testflight
description: Send a City Crew iOS binary to TestFlight. Decides whether a binary is needed at all, picks the build profile (production for the App Store, preview for a build that may record diagnostics), bumps the version when the last one is approved, writes the What's New in three languages, re-checks the catalog figures the listing quotes, and runs the Release app to TestFlight workflow. Use for an App Store release, a diagnostic preview build, or re-submitting a build EAS already has.
disable-model-invocation: true
---

# Release to TestFlight

User-only: a run spends EAS build time, adds a build to App Store Connect,
and can notify every internal tester. `.github/workflows/app-release.yml`
explains each of those in its header. Read it once per release; this
skill is its checklist, not a replacement.

## 1. Does this need a binary at all?

Most changes don't. A merge that touches `app/` publishes an EAS Update
(`app-preview.yml`), and installed builds pick it up within seconds. A
binary is needed only for what lives in it:
- an Expo SDK bump. `runtimeVersion` follows `sdkVersion`, so binaries on
  the old SDK stop receiving updates from main the moment the bump merges.
  Release straight after it.
- a new or upgraded native module, config plugin, permission string,
  `app.json` native field or anything in `app/patches/`
- an App Store release, i.e. new What's New and a version reviewers see
- a `preview` build for measuring (`docs/tracing.md`)

If none of these applies, say so and stop. A JavaScript change needs only
its merge.

## 2. Which profile

Ask, unless the user already said. **TestFlight does not decide the
channel; the profile does**, and the channel is stamped into the binary
for good:

| profile | for | diagnostics |
|---|---|---|
| `production` (default, and what a tag push makes) | the App Store, and every ordinary TestFlight build | **off**, and `app/src/lib/legal.ts` promises it is |
| `preview` | measuring on a real device: the launch waterfall, the deck's timeline | **on** |

A `preview` build in testers' hands records traces. Make one only when
someone means to read them, and say so when you start one.

## 3. Is the version's train open?

Read `version` in `app/app.json` and ask the user (or check App Store
Connect if you can see it) whether that version is already **approved**
on the App Store. If it is, its pre-release train is closed, and every
upload under it is refused at submit time, after the whole build has been
paid for:

```
Invalid Pre-Release Train. The train version '1.0.3' is closed for
new build submissions (409)
```

That is what happened to 1.0.3 (21). If it is approved, bump the patch
(`1.0.11` → `1.0.12`) in a PR before anything else. The build number
needs nothing from you: EAS holds it remotely and increments it
(`appVersionSource: remote`, `autoIncrement`).

## 4. For an App Store release: What's New and the figures

Skip this for a `preview` build or a re-submission.

**What's New** goes in `docs/store/listing.md` as `## Release notes
v<version> (What's New)`, after the last such section. They run oldest to
newest. Follow the `v1.0.11` section:
- an opening paragraph (in Vietnamese, as the file is) naming the PR
  range it covers (`git log` since the last release commit, `Release
  1.0.x: …`), whether the binary is mandatory and why, what to try on a
  device, and what was left out
- `### EN`, `### VI`, `### JA`, each in a fenced block, with the same
  points in each
- the rules in the v1.0.1 section: the biggest benefit first, everyday
  words, no internal names (Sketching, OTA, Edge Function), never "bug
  fixes and improvements", no promises of future features, 4,000
  characters at most

Only what a reader of the app notices goes in. Data Desk, docs, tests and
refactors stay out, and the opening paragraph says they were left out.

**The catalog figures.** The description counts cities, and Apple
guideline 2.3 makes that metadata that can go wrong. Run the query from
"Phạm vi phủ" in `listing.md` through the Supabase MCP `execute_sql` on
`amdvitzpogaejzzqroco`:

```sql
select c.id, c.is_active, count(p.*) filter (where p.is_published and p.review_status='approved')
from cities c left join places p on p.city_id = c.id group by 1,2 order by 3 desc;
```

Compare it with the table there and with the city count in the
description, in all three languages. Raise any city that is active with
0 places with the user: the listing's rule is to turn `is_active` off
before submitting, not to count the city. Update the table and its date.

Version bump, What's New and figures go in one PR, named like the last
ones: `Release 1.0.x: What's New covers #…`. It has to merge before the
build, because the workflow builds from the ref you give it, and that
ref should be main.

## 5. Run the workflow

Before you run anything, show the user one line: profile, platform,
version, and the main commit it will build (`git rev-parse origin/main`
after a fetch, all 40 characters). Wait for a yes.

GitHub MCP `actions_run_trigger`:
- `method`: `run_workflow`
- `workflow_id`: `app-release.yml`
- `ref`: `main`
- `inputs`: `{ "platform": "ios", "profile": "<production|preview>" }`

To submit a build EAS already has (the build passed and the submission
did not), pass `build_id` as well, and the build is not made again.

A tag push (`git tag v1.0.x && git push origin v1.0.x`) also starts it,
always as `production` / `ios`. Use it only if the user asks for a tag.
The tag is a name, not a version: nothing compares it with `app.json`.

## 6. What a green job means

**"EAS accepted the job", and nothing more.** The workflow runs with
`--no-wait`, so the build has not even started when the check goes
green. Find the run with `actions_list` (`list_workflow_runs` on
`app-release.yml`) and give the user the EAS build URL from its log
(`get_job_logs`). Then tell them to watch two places, because they fail
separately:
- the **build** page on expo.dev
- the **Submissions** page on expo.dev, and after that App Store
  Connect → TestFlight, where the build appears only once processing
  finishes

Don't report the release as done. Report it as queued, with both links.

## 7. After the App Store approves it

That closes the version's train (step 3). The next release's first commit
bumps `version`. Say so in the release PR's body, so it isn't left for
the next person to find out at submit time.
