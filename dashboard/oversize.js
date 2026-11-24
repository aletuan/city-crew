// The functions that are larger than a function may be, each with the
// size it stood at when it was measured — and may not pass.
//
// The app's ratchet (`app/oversize.js`, whose header carries the
// reasoning), brought here on 24 Nov 2026 by the code review's F6: the app
// had a ceiling and this package did not, so the desk's components grew
// with nothing to say so. Measured that day with the app's own ceiling,
// 150 lines of code and a complexity of 25:
//
//   PlaceEditor 515 / 57, PlaceList 464 / 50 (442 once its select box
//   was one component, the same day), App 285 / 41,
//   CityHero 275 / 36, Reports 189, Contributors 156, Coverage 30.
//
// Every other file is held to `CEILING`. A file below is held to its own
// number, which is where it stood: add to its largest function and lint
// is red. When a function comes down, lower its number in the same
// change; when it is under the ceiling, take the line out. A dimension a
// file does not name is held to the ceiling.
//
// Paths relative to `dashboard/`.

export const CEILING = { lines: 150, complexity: 25 };

export const OVERSIZE = {
  'src/components/PlaceEditor.jsx': { lines: 515, complexity: 57 },
  'src/components/PlaceList.jsx': { lines: 442, complexity: 50 },
  'src/App.jsx': { lines: 285, complexity: 41 },
  'src/components/CityHero.jsx': { lines: 275, complexity: 36 },
  'src/components/Reports.jsx': { lines: 189 },
  'src/components/Contributors.jsx': { lines: 156 },
  'src/components/Coverage.jsx': { complexity: 30 },
};
