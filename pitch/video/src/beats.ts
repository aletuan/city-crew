// Beat grid for the music-driven edit. The whole timeline is expressed in
// bars/beats of the track so every cut and caption lands on the grid.
//
// ACTIVE TRACK: "Carefree" (Kevin MacLeod) — measured 96.000 BPM
// (see ../music/CREDITS.md). Swap the block below to change tracks.
//
// "Carefree" (this file):   BPM 96,  window 33.42s, wow anchor = downbeat
//                           65.92s (start of the full section) → bar 13.
// "Life of Riley" (v4):     BPM 102, MUSIC_FILE 'music/bg.mp3',
//                           MUSIC_START_FROM sec(82.335), chorus at bar 13.

export const FPS = 30;
export const BPM = 96;
export const BEAT_SEC = 60 / BPM; // 0.625s
export const BAR_SEC = BEAT_SEC * 4; // 2.5s

export const sec = (s: number) => Math.round(s * FPS);
/** Downbeat frame of bar n (0-indexed). */
export const bar = (n: number) => sec(n * BAR_SEC);
/** Frame of beat n (0-indexed, 4 per bar). */
export const beat = (n: number) => sec(n * BEAT_SEC);

/** Which file in video/public the composition plays. */
export const MUSIC_FILE = 'music/bg-carefree.mp3';
// Frames to trim off the front of the track so beat 0 lands on frame 0.
// Mellow ukulele verse under the story; the arrangement fills out at the
// 65.92s downbeat, which lands on video bar 13 — the wow moment.
export const MUSIC_START_FROM = sec(33.42);
/** The bar whose downbeat carries the arrangement lift — the wow moment. */
export const DROP_BAR = 13;
/** Total length: 25 bars = 62.5s. */
export const TOTAL_BARS = 25;
