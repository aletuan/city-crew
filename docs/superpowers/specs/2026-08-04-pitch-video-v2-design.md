# CityCrew Pitch Video v2 — Design

**Date:** 2026-08-04 · **Status:** approved by Andy

## Goal

Replace the 90s voiceover-driven landscape draft (`draft-v1.mp4`, deleted) with a
**~60-second, vertical (1080×1920), music-driven pitch video** with young, fast
lifestyle energy. No voiceover — the story is carried by on-screen kinetic
captions synced to the music's beat. English captions only. Deliverable is a
rendered MP4 built with the existing Remotion project.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Deliverable | Rendered MP4 (not an interactive web pitch) |
| Framework | Keep Remotion ("hyperframe" does not exist; Motion Canvas rejected — clunkier webm embedding, working pipeline already in place) |
| Format | Vertical 9:16, 1080×1920 @ 30fps |
| Length | ~60 seconds |
| Audio | Royalty-free/CC0 upbeat electronic/pop track (~120–128 BPM), no VO |
| Captions | English only |

## Architecture

```
pitch/
  script.md            → rewritten: ~15 caption lines (was 6 VO segments)
  music/bg.mp3         → sourced royalty-free track; BPM recorded in beats.ts
  recorder/record.mjs  → re-pointed at "cityCrew C2 Mockup Dark (standalone).html"
  clips/               → re-recorded phone-shaped webm clips (old ones showed
                         the pre-C2 mockup with broken card images)
  video/src/
    beats.ts           → NEW: BPM constant + bar/beat→frame helpers (replaces
                         VO-duration-driven timings.json)
    PitchVertical.tsx  → NEW: the 60s composition
    Root.tsx           → registers PitchVertical
  out/pitch-v2.mp4     → rendered output (gitignored)
```

VO plumbing is deleted: `recorder/make-vo.sh`, `voice/`, vo sync in
`sync-assets.sh`, `timings.json`, and the old `Pitch.tsx` composition.

## Composition structure (~60s)

Every cut and caption entrance lands on the beat grid (bars at track BPM).

1. **Hook (0–6s)** — kinetic type on dark bg: "Every weekend, the same
   question." → "WHERE SHOULD WE GO?" Words spring in per-beat.
2. **Problem (6–16s)** — chat-chaos motif: message bubbles pile up and shake;
   captions "20 messages. 3 polls. Still no plan."
3. **Demo (16–44s)** — C2 clips inside a floating phone frame with parallax
   tilt; whip cuts on downbeats; one caption per feature: no sign-up →
   collections → save → 30-second AI itinerary → one shared link; beat-synced
   zoom punches.
4. **Potential (44–52s)** — stat/tagline beats.
5. **Close (52–60s)** — "One organizer. One perfect day." → logo on brand
   gradient → CTA.

**Visual system** mirrors the C2 mockup tokens: base `#0B0910`, gradient
`#8B5CF6 → #EC6CC9 → #F6A45C`, glassmorphism cards, glow + film grain,
Figtree via `@remotion/google-fonts`.

## Verification

- Remotion Studio preview during development.
- Rendered still frames at each section boundary for human review.
- Final render checked for duration (~60s ±2s), resolution 1080×1920, audible
  audio track, and file plays end to end.
