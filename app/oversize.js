// The functions that are larger than a function may be, each with the
// size it stood at when it was measured — and may not pass.
//
// ── why there is a ceiling at all ──
//
// A screen grows a few lines at a time, each of them reasonable.
// `CollectionDetailScreen` went from about 1,690 lines on 20 Oct 2026 to
// 2,521 on 15 Nov, and nothing turned red on the way: the coverage floors
// hold a screen correct, not readable (docs/architecture.md says so under
// "Chỗ kiến trúc chưa sạch"). Seven screens had their parts moved out on
// 15 Nov (#1355, #1357); this is what keeps them from growing back.
//
// ── the two measures, and why these numbers ──
//
// `lines` is ESLint's `max-lines-per-function`, comments and blank lines
// left out — this codebase is a third comment, and a rule that counted
// them would be a rule against explaining. `complexity` is its cyclomatic
// `complexity`.
//
// 150 and 25 are ceilings chosen, not measured; what was measured is who
// they catch (15 Nov 2026, on de170c75, every non-test file under `src/`
// and `App.tsx`). At 150 lines: 32 files. At the usual complexity of 15:
// 45 files, 18 of them over on complexity alone and all but two of those
// at 26 or under — a component's `&&` and `?:` in JSX each count as a
// branch, so a row that draws four optional things reads as complex and is
// not. At 25 the list is the lines list and two more (`CandidateRow`,
// `planner`): the same files by either measure, which is the sign that the
// measure is finding size and not syntax.
//
// ── a ratchet, the other way up from coverage ──
//
// Every other file is held to `CEILING`. A file below is held to its own
// number, which is where it stood: add to its largest function and lint
// is red. When a function comes down, lower its number in the same
// change; when it is under the ceiling, take the line out. Nothing checks
// that a number here is still the true one — the coverage floors are
// lowered and raised by hand too — so a number left high is slack, and
// the next person to measure should take it up.
//
// A dimension a file does not name is held to the ceiling.
//
// CommonJS, and a file of its own, for `impure.js`'s reasons: the ESLint
// config `require`s it without a build step, and the list is data.
//
// Paths relative to `app/`.

const CEILING = { lines: 150, complexity: 25 };

const OVERSIZE = {
  'src/screens/CollectionDetailScreen.tsx': { lines: 740, complexity: 137 },
  'src/screens/CollectionsScreen.tsx': { lines: 716, complexity: 56 },
  'src/screens/CrewScreen.tsx': { lines: 664, complexity: 32 },
  'src/screens/PlaceDetailScreen.tsx': { lines: 663, complexity: 118 },
  'src/screens/ExploreScreen.tsx': { lines: 567, complexity: 49 },
  'src/screens/IdeasScreen.tsx': { lines: 493, complexity: 51 },
  'src/screens/SearchScreen.tsx': { lines: 461, complexity: 40 },
  'src/components/StartSheet.tsx': { lines: 412, complexity: 34 },
  'src/screens/SignUpScreen.tsx': { lines: 365 },
  'src/screens/GalleryScreen.tsx': { lines: 356, complexity: 46 },
  'src/screens/PlanEditScreen.tsx': { lines: 317 },
  'src/screens/CollectionFormScreen.tsx': { lines: 179 },
  'src/screens/TripDetailScreen.tsx': { lines: 292, complexity: 34 },
  'src/components/ExploreFilterSheet.tsx': { lines: 280 },
  'src/screens/EditProfileScreen.tsx': { lines: 258, complexity: 27 },
  'src/screens/SketchingScreen.tsx': { lines: 255, complexity: 38 },
  'src/screens/VisitedScreen.tsx': { lines: 243, complexity: 27 },
  'src/screens/TripsScreen.tsx': { lines: 194, complexity: 31 },
  'src/lib/auth.tsx': { lines: 204 },
  'src/screens/CollectionActivityScreen.tsx': { lines: 162 },
  'src/screens/TripInvitationScreen.tsx': { lines: 218, complexity: 66 },
  'src/screens/ActivityScreen.tsx': { lines: 175 },
  'src/components/FloatingTabBar.tsx': { lines: 187 },
  'src/components/ThemeSwitcher.tsx': { lines: 179 },
  'src/components/SignupTour.tsx': { lines: 183 },
  'src/lib/city.tsx': { lines: 179 },
  'src/components/PlaceCard.tsx': { lines: 166, complexity: 50 },
  'src/components/AvatarPicker.tsx': { lines: 165 },
  'src/components/PhotoSheet.tsx': { lines: 158 },
  'src/screens/ForgotPasswordScreen.tsx': { lines: 157 },
  'src/screens/explore/Hero.tsx': { complexity: 35 },
  'src/components/CandidateRow.tsx': { complexity: 34 },
  'src/lib/planner.ts': { complexity: 26 },
};

module.exports = { CEILING, OVERSIZE };
