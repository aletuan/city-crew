# CityCrew — 60-Second Pitch v4 (interactive-feel, soft & friendly music)

**Format:** 1080×1920 vertical · 30fps · 61.2s
**Audio:** "Life of Riley" — Kevin MacLeod, 102 BPM (see `music/CREDITS.md`).
**Music window:** track 82.34s → ~143.5s — soft, warm verse under the story,
**chorus lift at video bar 13 (0:30.6)** carries the wow moment: the finger taps
**✨ Generate plan** and the whole day appears.

The demo clips are simulated user sessions recorded from the C2 mockup: a
visible finger dot moves between controls, taps ripple, buttons press, tile
rows swipe (`recorder/record.mjs`).

**Grid:** 102 BPM · 1 bar = 2.353s · 26 bars. All cuts land on downbeats.

| Section | Bars | Time | On screen |
|---|---|---|---|
| Problem intro | 0–6 | 0:00–0:15 | Real TikTok/Threads captures: save a café video (tap ripple + "Saved ✓"), a cơm tấm Threads post → weeks later the cards pile up grayscale: "Outdated. Scattered." → "Still no plan." |
| Demo A | 6–8 | 0:14.1–0:18.8 | clip-a: tap "Start exploring", swipe tiles |
| Demo B | 8–10 | 0:18.8–0:23.5 | clip-b: bookmark tap → detail → add to plan |
| Demo C | 10–12 | 0:23.5–0:28.2 | clip-c: wizard chips + continue |
| **WOW** | 12–15 | 0:28.2–0:35.3 | clip-d: hover "Ready?" → tap Generate → **chorus lift**: plan reveals + flash + shockwave |
| Demo E | 15–18 | 0:35.3–0:42.4 | clip-e: share read-only link → collections |
| Potential | 18–21 | 0:42.4–0:49.4 | Tagline beats |
| Close | 21–26 | 0:49.4–1:01.2 | Logo + CTA |

## Captions

1. `You find the perfect rooftop café…` (TikTok search capture)
2. `Save it on TikTok. Done.` (tap ripple on the real bookmark icon)
3. `Best cơm tấm in town? In a Threads post.` (Threads search capture)
4. `Weeks later…` → `Outdated. Scattered. Unfindable.` → `Still no plan.` (gradient; cards pile up grayscale)
5. `Meet cityCrew.` → `Tap in — no sign-up.` (demo A)
6. `Save what you love. One tap.` (demo B)
7. `Your crew. Your vibe.` (demo C)
8. `Ready?` (pulsing, finger hovering on Generate)
9. `WHOLE DAY. DRAFTED IN 30 SECONDS.` (gradient, ON THE LIFT)
10. `One read-only link. Zero chaos.` (demo E)
11. `Built for the friend who always organizes.` / `Every crew. Every city.`
12. `One organizer. One perfect day.` → **cityCrew** logo + `Plan your city days — together.`

## Wow-moment mechanics

- Chorus lift measured at track 112.923s; window offset 82.335s puts it on
  bar 13's downbeat.
- clip-d's reveal is at clip-time 5.45s (measured by frame differencing);
  `startFrom: 3.097s` lands it frame-exact on the lift.
- At the lift: soft white flash (0.7 peak), dual shockwave rings, phone scale
  punch, big gradient caption; pre-lift pulsing "Ready?" hover.

## Notes

- Re-recording clips changes action timings — re-measure before re-cutting
  (`ffmpeg` frame-diff, see git history for the method).
- Publish credit: *Music: "Life of Riley" by Kevin MacLeod
  (incompetech.com), CC BY 4.0.*
