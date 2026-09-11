## Summary

Three new iOS smoke flows for the paths a signed-in reader depends on. Until now the Maestro suite only walked the guest path.

| Flow | Checks |
| --- | --- |
| `04-sign-in` | A wrong password shows the form error; the right one signs in; a cold start is still signed in; sign out returns to the guest Profile. |
| `05-plan-trip` | Ideas wizard (Friends + up to three moods) → Sketching → recommended plan → Save → the trip is the only upcoming one on Trips → delete it. |
| `06-save-place` | First place on Explore → bookmark into the first collection → the bookmark fills → take it out again → sign out. |

- **Dedicated test account.** Credentials are passed with `-e TEST_EMAIL=… -e TEST_PASSWORD=…` and never written into a flow. The README covers the one-time setup: sign up, confirm the email, create one collection.
- **Self-cleaning.** Each flow undoes what it made, and also what a failed earlier run left behind. `05` deletes every upcoming trip on the test account before it starts, so the account must be used for nothing else.
- **Selectors.** The flows select by `testID` only. The exception is iOS alert buttons, which are matched in all three app languages.
- **New testIDs.** Profile, SignIn, Ideas, PlanEdit, Trips, TripDetail, PlaceDetail and SaveSheet each get one or more new ids. `Chip`, `GradientCta` and `PrimaryButton` gain an optional `testID` prop. The bookmark on PlaceDetail has one id per state (`detail-save` / `detail-saved`), so a flow can wait for a save to land without reading a label. No behaviour or visual change.
- **`scripts/maestroIds.test.ts`.** Reads every id the flows use and fails in CI if the source no longer sets it, so a rename shows up at once rather than on the next manual Mac run.

## Test plan

- [x] `maestro check-syntax` (2.10.0) is OK for every flow and subflow.
- [x] `maestroIds.test.ts`: 38 ids found; a deliberate rename fails it.
- [x] `tsc`, lint and a full coverage run (2,533 tests, gates hold) are green.
- [ ] On a Mac with the test account: `npm run smoke:ios -- -e EXPO_URL=… -e TEST_EMAIL=… -e TEST_PASSWORD=…`, all 7 flows green. The new flows have not been run on a simulator yet; this PR can't be verified without that.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01R7fTusinpongdPe3nrg2JP
