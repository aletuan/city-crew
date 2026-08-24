// Whether the app is still holding its first frame.
//
// `App.tsx` draws nothing but its own ground colour until the display faces
// and the stored theme are in. That hold is deliberate — a dark-mode reader
// seeing a white flash on every launch, or titles rendering in the system
// font and swapping a frame later, are both worse than a beat of nothing.
//
// It is a decision rather than a condition, and it lives here rather than
// inline for the reason `place.ts` gives: a `if (...) return <View/>` inside
// a component is unreachable from a Node process, and this is the one line
// in the app whose failure mode is a screen that never changes.
//
// ── the case this exists for ──
//
// `useFonts` answers `[loaded, error]`, and the app read only the first of
// those. A font that failed to load left `loaded` false forever, so the hold
// never lifted: a white screen on launch, no message, nothing in a log.
//
// The answer to a failed font is not to keep waiting. It is to go on
// without it — the faces are display type, so the cost of proceeding is
// headings in the system font, which is the glitch the hold was avoiding
// and is plainly better than an app that never starts. A reader gets a
// slightly wrong-looking app instead of no app.
//
// ── what this does not cover ──
//
// A load that neither lands nor fails. Nothing here can see that: if the
// renderer stops committing state at all, `loaded` and `failed` both stay
// false and this keeps holding, correctly, on the only information it has.
// That is what a white screen meant on 2026-08-24, and no branch in this
// file would have caught it — see `expo install --check` in checks.yml,
// which is the gate that would have.

export type BootState = {
  /** `useFonts`'s first answer: the faces are in. */
  fontsLoaded: boolean;
  /** Its second: they are not coming. A truthy error, coerced. */
  fontsFailed: boolean;
  /** The stored colour scheme has been read once — see `lib/theme`. */
  themeReady: boolean;
};

/**
 * True while the app should draw its holding frame and nothing else.
 *
 * The theme is waited for unconditionally: it is a read from local storage
 * that always settles, and showing the wrong ground first is the one thing
 * the hold exists to prevent. The fonts are waited for only while they may
 * still arrive.
 */
export function holdingFirstFrame(s: BootState): boolean {
  if (!s.themeReady) return true;
  return !s.fontsLoaded && !s.fontsFailed;
}
