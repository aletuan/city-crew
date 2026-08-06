import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Figtree';
import { FPS, BEAT_SEC, bar, beat, sec, MUSIC_FILE, MUSIC_START_FROM, DROP_BAR, TOTAL_BARS } from './beats';

const { fontFamily } = loadFont();

// ── theme (mirrors the C2 mockup's design tokens) ──
const BG = '#0B0910';
const GRAD = 'linear-gradient(96deg,#8B5CF6 0%,#EC6CC9 52%,#F6A45C 100%)';
const DIM = 'rgba(255,255,255,0.72)';
const FAINT = 'rgba(255,255,255,0.5)';
const GLASS = 'rgba(255,255,255,0.07)';
const GLASS_BORDER = 'rgba(255,255,255,0.14)';

export const DURATION = bar(TOTAL_BARS); // 26 bars @ 102 BPM ≈ 61.2s

// Deterministic pseudo-random (render-thread safe — no Math.random).
const rand = (i: number, salt = 0) => {
  const x = Math.sin((i + 1) * 127.1 + (salt + 1) * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ── shared bits ─────────────────────────────────────────────────────────────

const gradText: React.CSSProperties = {
  background: GRAD,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

/** Words spring in one after another, staggered by half-beats.
 * NOTE: gradient text must go on `wordStyle`, not `style` — background-clip:text
 * on the container silently breaks once the word spans carry transforms. */
const WordPop: React.FC<{
  text: string;
  delay?: number; // local frames before the first word
  stagger?: number; // frames between words
  style?: React.CSSProperties;
  wordStyle?: React.CSSProperties;
}> = ({ text, delay = 0, stagger = Math.round(sec(BEAT_SEC) / 2), style, wordStyle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '0.28em', ...style }}>
      {text.split(' ').map((w, i) => {
        const f = frame - delay - i * stagger;
        const s = spring({ frame: f, fps, config: { damping: 14, stiffness: 260, mass: 0.8 } });
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: f < 0 ? 0 : s,
              transform: `translateY(${(1 - s) * 46}px) scale(${0.82 + 0.18 * s})`,
              ...wordStyle,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** Beat-synced ambient glow behind everything. */
const Ambient: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 0.5 + 0.5 * Math.cos((frame / sec(BEAT_SEC)) * Math.PI * 2);
  const drift = frame * 0.15;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          width: 1400,
          height: 1400,
          left: -500 + Math.sin(drift / 60) * 90,
          top: -420,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.30), transparent 65%)',
          opacity: 0.5 + pulse * 0.22,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1300,
          height: 1300,
          right: -520 - Math.sin(drift / 74) * 70,
          bottom: -430,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(246,164,92,0.22), transparent 65%)',
          opacity: 0.45 + pulse * 0.2,
        }}
      />
    </AbsoluteFill>
  );
};

/** Static film grain + vignette. */
const GRAIN_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"/><feColorMatrix type="saturate" values="0"/></filter><rect width="300" height="300" filter="url(#n)" opacity="0.5"/></svg>`
  );
const Texture: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <AbsoluteFill style={{ backgroundImage: `url("${GRAIN_URI}")`, opacity: 0.055, mixBlendMode: 'overlay' }} />
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse 90% 70% at 50% 45%, transparent 55%, rgba(0,0,0,0.5))' }} />
  </AbsoluteFill>
);

// ── 1 · Hook (bars 0–2) ─────────────────────────────────────────────────────

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [bar(2) - 8, bar(2)], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 90, opacity: out }}>
      <WordPop
        text="Every weekend. Same question."
        stagger={Math.round(sec(BEAT_SEC) * 0.75)}
        style={{ fontSize: 64, fontWeight: 600, color: DIM, letterSpacing: -1 }}
      />
      <div style={{ height: 60 }} />
      <WordPop
        text="WHERE SHOULD WE GO?"
        delay={bar(1)}
        stagger={Math.round(sec(BEAT_SEC) / 2)}
        style={{ fontSize: 132, fontWeight: 800, letterSpacing: -4, lineHeight: 1.02 }}
        wordStyle={gradText}
      />
    </AbsoluteFill>
  );
};

// ── 2 · Problem (bars 2–6): chat chaos ──────────────────────────────────────

const BUBBLES = [
  'where tho? 😅', 'rooftop??', 'too far 😩', 'poll #3 📊', 'saturday???',
  "what's the budget", '🍜 ?', "i'm out lol", 'this again 🙄', 'someone decide pls',
  'link? which link', 'i saved it somewhere…',
];

const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localBars = (n: number) => bar(2 + n) - bar(2); // local frame of bar offset n

  // shake on "Still no plan."
  const shakeAt = localBars(2.5);
  const shake =
    frame >= shakeAt && frame < shakeAt + 12
      ? Math.sin((frame - shakeAt) * 2.4) * (12 - (frame - shakeAt))
      : 0;

  const stats = [
    { text: '20 messages.', at: 0 },
    { text: '3 polls.', at: 1 },
    { text: '2 arguments.', at: 2 },
  ];

  return (
    <AbsoluteFill style={{ transform: `translateX(${shake}px)` }}>
      {/* raining chat bubbles */}
      {BUBBLES.map((t, i) => {
        const start = Math.round(i * sec(BEAT_SEC));
        const f = frame - start;
        if (f < 0) return null;
        const s = spring({ frame: f, fps, config: { damping: 13, stiffness: 220 } });
        const x = 60 + rand(i) * 700;
        const y = 240 + rand(i, 7) * 1300;
        const rot = (rand(i, 3) - 0.5) * 14;
        const fadeOut = interpolate(frame, [localBars(3.2), localBars(4)], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              padding: '22px 34px',
              borderRadius: 32,
              borderTopLeftRadius: i % 2 ? 32 : 8,
              borderBottomRightRadius: i % 2 ? 8 : 32,
              background: GLASS,
              border: `1.5px solid ${GLASS_BORDER}`,
              color: DIM,
              fontSize: 34,
              fontWeight: 500,
              opacity: s * fadeOut,
              transform: `scale(${s}) rotate(${rot}deg)`,
              backdropFilter: 'blur(6px)',
            }}
          >
            {t}
          </div>
        );
      })}

      {/* stat punches on downbeats */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        {stats.map(({ text, at }, i) => {
          const f = frame - localBars(at);
          if (f < 0) return null;
          const s = spring({ frame: f, fps, config: { damping: 12, stiffness: 240 } });
          const gone = interpolate(f, [bar(1) - bar(0) - 10, bar(1) - bar(0)], [1, 0.0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const still = frame - localBars(3);
          return (
            <div
              key={text}
              style={{
                position: 'absolute',
                top: 480 + i * 240,
                fontSize: 108,
                fontWeight: 800,
                letterSpacing: -3,
                color: '#fff',
                opacity: s * (still >= 0 ? 0.28 : 1) * (0.4 + 0.6 * gone),
                transform: `scale(${0.9 + 0.1 * s})`,
              }}
            >
              {text}
            </div>
          );
        })}

        {/* Still no plan. */}
        {frame >= localBars(2.5) && (
          <div style={{ position: 'absolute', top: 700, textAlign: 'center' }}>
            <WordPop
              text="Still no plan."
              delay={localBars(2.5)}
              style={{ fontSize: 148, fontWeight: 800, letterSpacing: -4 }}
              wordStyle={gradText}
            />
          </div>
        )}
        {frame >= localBars(3.2) && (
          <div style={{ position: 'absolute', top: 950, width: 820, textAlign: 'center' }}>
            <WordPop
              text="Your ideas? Lost in saves, pins & screenshots."
              delay={localBars(3.2)}
              stagger={4}
              style={{ fontSize: 54, fontWeight: 600, color: FAINT }}
            />
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── 1+2 · ProblemIntro (bars 0–6): real TikTok/Threads captures ────────────
// You save a café video on TikTok, a restaurant thread on Threads… weeks
// later it's all outdated, scattered, useless. Screenshots captured from the
// user's real sessions (see clips/problem/).

type Shot = {
  src: string;
  w: number;
  h: number;
  enter: number; // local frame the card flies in
  tilt: number;
  x: number;
  y: number;
  ripple?: { x: number; y: number }; // fraction of card size — save-tap ripple
};

const ProblemIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const SHOTS: Shot[] = [
    { src: 'problem/tiktok-search.jpg', w: 940, h: 489, enter: 0, tilt: -2, x: 70, y: 500 },
    { src: 'problem/tiktok-video.jpg', w: 940, h: 489, enter: beat(4), tilt: 2.5, x: 70, y: 810,
      ripple: { x: 0.796, y: 0.282 } },
    { src: 'problem/threads-search.jpg', w: 800, h: 667, enter: bar(2), tilt: -3, x: 140, y: 560 },
    { src: 'problem/threads-food.jpg', w: 940, h: 489, enter: bar(2) + beat(4), tilt: 2, x: 70, y: 950 },
  ];
  const pileAt = bar(4);

  const captions: { text: string; at: number; big?: boolean; grad?: boolean; dim?: boolean }[] = [
    { text: 'You find the perfect rooftop café…', at: 0 },
    { text: 'Save it on TikTok. Done.', at: beat(4) },
    { text: 'Best cơm tấm in town? In a Threads post.', at: bar(2) },
    { text: 'Weeks later…', at: bar(4), dim: true },
    { text: 'Outdated. Scattered. Unfindable.', at: bar(4.5), big: true },
    { text: 'Still no plan.', at: bar(5), big: true, grad: true },
  ];

  return (
    <AbsoluteFill>
      {SHOTS.map((s, i) => {
        const f = frame - s.enter;
        if (f < 0) return null;
        const enterS = spring({ frame: f, fps, config: { damping: 14, stiffness: 170 } });
        const pileS =
          frame >= pileAt
            ? spring({ frame: frame - pileAt - i * 3, fps, config: { damping: 13, stiffness: 110 } })
            : 0;
        const tilt = s.tilt + pileS * (rand(i, 5) - 0.5) * 30;
        const x = s.x + pileS * (rand(i, 9) - 0.5) * 320;
        const y = s.y + (1 - enterS) * 180 + pileS * (860 - s.y + (rand(i, 11) - 0.5) * 200);
        const scale = (0.96 + 0.04 * enterS) * (1 - 0.34 * pileS);
        return (
          <div
            key={s.src}
            style={{
              position: 'absolute',
              left: s.x,
              top: y,
              width: s.w,
              height: s.h,
              opacity: enterS,
              transform: `translateX(${x - s.x}px) rotate(${tilt}deg) scale(${scale})`,
              borderRadius: 26,
              overflow: 'hidden',
              border: `2px solid ${GLASS_BORDER}`,
              boxShadow: '0 40px 100px rgba(0,0,0,0.55)',
              filter: `grayscale(${pileS}) brightness(${1 - 0.4 * pileS})`,
            }}
          >
            <Img
              src={staticFile(s.src)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%' }}
            />
            {/* simulated save-tap: expanding ripple + "Saved" chip */}
            {s.ripple && f >= 14 && f < 60 && (
              <>
                {(() => {
                  const p = Math.min(1, (f - 14) / 22);
                  const size = 24 + p * 150;
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${s.ripple.x * 100}%`,
                        top: `${s.ripple.y * 100}%`,
                        width: size,
                        height: size,
                        marginLeft: -size / 2,
                        marginTop: -size / 2,
                        borderRadius: '50%',
                        border: `${5 - 3.5 * p}px solid rgba(255,255,255,${0.9 * (1 - p)})`,
                        background: `radial-gradient(circle, rgba(236,108,201,${0.35 * (1 - p)}), transparent 70%)`,
                      }}
                    />
                  );
                })()}
                {f >= 22 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${s.ripple.x * 100 - 14}%`,
                      top: `${s.ripple.y * 100 + 9}%`,
                      padding: '10px 22px',
                      borderRadius: 999,
                      background: GRAD,
                      color: '#fff',
                      fontSize: 30,
                      fontWeight: 700,
                      opacity: Math.min(1, (f - 22) / 6),
                      transform: `scale(${0.8 + 0.2 * Math.min(1, (f - 22) / 8)})`,
                    }}
                  >
                    Saved ✓
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* captions — newest wins the top slot */}
      {captions.map((c) => {
        const f = frame - c.at;
        if (f < 0) return null;
        const later = captions.filter((o) => o.at > c.at && frame >= o.at);
        if (later.length > 0) return null;
        return (
          <div key={c.text} style={{ position: 'absolute', top: c.big ? 150 : 170, left: 64, right: 64, textAlign: 'center' }}>
            <WordPop
              text={c.text}
              delay={c.at}
              stagger={c.big ? 3 : 4}
              style={{
                fontSize: c.big ? 92 : 62,
                fontWeight: 800,
                letterSpacing: c.big ? -2.5 : -1,
                color: c.dim ? FAINT : '#fff',
                lineHeight: 1.08,
              }}
              wordStyle={c.grad ? gradText : undefined}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── 3 · Demo (bars 8–23): phone clips, cut on downbeats ────────────────────

type Caption = { text: string; atBeat: number; big?: boolean; grad?: boolean };
type Segment = {
  clip: string;
  fromBar: number;
  toBar: number;
  startFrom: number; // seconds to skip inside the recording
  captions: Caption[]; // beats after segment start
  wow?: boolean; // this segment hosts the drop (DROP_BAR)
};

// Each clip is a real simulated user session: visible finger, tap ripples,
// button presses, tile swipes. Windows chosen from measured action times.
const SEGMENTS: Segment[] = [
  {
    clip: 'clip-a-home-swipe.webm', // tap "Start exploring" → swipe tile row
    fromBar: 6,
    toBar: 8,
    startFrom: 3.4,
    captions: [
      { text: 'Meet cityCrew.', atBeat: 0 },
      { text: 'Tap in — no sign-up.', atBeat: 4 },
    ],
  },
  {
    clip: 'clip-b-explore-save.webm', // bookmark tap → detail → add to plan
    fromBar: 8,
    toBar: 10,
    startFrom: 4.2,
    captions: [{ text: 'Save what you love. One tap.', atBeat: 0 }],
  },
  {
    clip: 'clip-c-wizard-steps.webm', // wizard chips + continue taps
    fromBar: 10,
    toBar: 12,
    startFrom: 4.6,
    captions: [{ text: 'Your crew. Your vibe.', atBeat: 0 }],
  },
  {
    clip: 'clip-d-wow-generate.webm', // hover… tap Generate → chorus lift: plan reveals
    fromBar: 12,
    toBar: 15,
    startFrom: 2.95, // reveal at clip 5.45s → lands exactly on bar 13 downbeat
    wow: true,
    captions: [
      { text: 'Ready?', atBeat: 0 },
      { text: 'WHOLE DAY. DRAFTED IN 30 SECONDS.', atBeat: 4, big: true, grad: true },
    ],
  },
  {
    clip: 'clip-e-share.webm', // share read-only tap → collections
    fromBar: 15,
    toBar: 18,
    startFrom: 3.9,
    captions: [{ text: 'One read-only link. Zero chaos.', atBeat: 0 }],
  },
];

const PHONE_W = 770; // clip aspect 864:1744, sized so the full phone fits below the caption zone
const PHONE_H = Math.round((PHONE_W / 864) * 1744);
const PHONE_TOP = 350;

const DemoSegment: React.FC<{ seg: Segment; index: number }> = ({ seg, index }) => {
  const frame = useCurrentFrame(); // local to this segment's Sequence
  const { fps } = useVideoConfig();
  const len = bar(seg.toBar) - bar(seg.fromBar);

  // whip-in: slide + un-blur over ~6 frames (skip on the very first segment)
  const whip = index === 0 ? 1 : spring({ frame, fps, config: { damping: 16, stiffness: 300 } });
  const slideX = (1 - whip) * (index % 2 ? -140 : 140);
  const blur = (1 - whip) * 14;

  // beat punch on the downbeat + slow drift zoom across the segment
  const punch = spring({ frame, fps, config: { damping: 11, stiffness: 180 } });
  let scale = 1.05 - 0.05 * punch + interpolate(frame, [0, len], [0, 0.025]);
  const tilt = (index % 2 ? 1 : -1) * interpolate(frame, [0, len], [1.6, -1.2]);

  // wow punch: on the drop the phone kicks out and springs back
  const wowLocal = seg.wow ? bar(DROP_BAR) - bar(seg.fromBar) : -1;
  if (seg.wow && frame >= wowLocal) {
    const wowS = spring({ frame: frame - wowLocal, fps, config: { damping: 12, stiffness: 160 } });
    scale += (1 - wowS) * 0.14;
  }

  return (
    <AbsoluteFill>
      {/* glow pad behind the phone */}
      <div
        style={{
          position: 'absolute',
          left: 1080 / 2 - PHONE_W / 2 - 60,
          top: PHONE_TOP - 20,
          width: PHONE_W + 120,
          height: PHONE_H,
          background: 'radial-gradient(ellipse 60% 45% at 50% 40%, rgba(236,108,201,0.28), transparent 70%)',
          filter: 'blur(30px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 1080 / 2 - PHONE_W / 2,
          top: PHONE_TOP,
          width: PHONE_W,
          height: PHONE_H,
          borderRadius: 86,
          overflow: 'hidden',
          border: `2px solid ${GLASS_BORDER}`,
          boxShadow: '0 60px 140px rgba(0,0,0,0.6)',
          transform: `translateX(${slideX}px) rotate(${tilt}deg) scale(${scale})`,
          filter: `blur(${blur}px)`,
        }}
      >
        <OffthreadVideo
          muted
          src={staticFile(`clips/${seg.clip}`)}
          startFrom={sec(seg.startFrom)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* captions pinned to the top zone */}
      {seg.captions.map((c) => {
        const f = frame - beat(c.atBeat);
        if (f < 0) return null;
        const prev = seg.captions.filter((o) => o.atBeat > c.atBeat && frame >= beat(o.atBeat));
        if (prev.length > 0) return null; // newest caption wins the slot
        // pre-drop caption ("Ready?") breathes with the beat
        const pulse = seg.wow && !c.big ? 0.75 + 0.25 * Math.cos((f / sec(BEAT_SEC)) * Math.PI * 2) : 1;
        return (
          <div key={c.text} style={{ position: 'absolute', top: c.big ? 96 : 130, left: 60, right: 60, textAlign: 'center', opacity: pulse }}>
            <WordPop
              text={c.text}
              delay={beat(c.atBeat)}
              stagger={c.big ? 2 : 3}
              style={{
                fontSize: c.big ? 88 : 66,
                fontWeight: 800,
                letterSpacing: c.big ? -2.5 : -1.5,
                color: '#fff',
                lineHeight: 1.08,
              }}
              wordStyle={c.grad ? gradText : undefined}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── the drop: white flash + expanding shockwave rings + glow surge ─────────
const WowBurst: React.FC = () => {
  const frame = useCurrentFrame(); // sequence starts at bar(DROP_BAR)
  const flash = interpolate(frame, [0, 2, 12], [0.7, 0.45, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ring = (delay: number, dur: number) => {
    const f = frame - delay;
    if (f < 0) return null;
    const p = Math.min(1, f / dur);
    const size = 300 + p * 2100;
    return (
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '46%',
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          borderRadius: '50%',
          border: `${10 - 8 * p}px solid rgba(255,255,255,${0.7 * (1 - p)})`,
          boxShadow: `0 0 ${120 * (1 - p)}px rgba(236,108,201,${0.6 * (1 - p)})`,
        }}
      />
    );
  };
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {ring(0, 22)}
      {ring(4, 26)}
      <AbsoluteFill style={{ background: '#fff', opacity: flash }} />
    </AbsoluteFill>
  );
};

// ── 4 · Potential (bars 18–21) ──────────────────────────────────────────────

const Potential: React.FC = () => {
  const frame = useCurrentFrame();
  const localBars = (n: number) => bar(18 + n) - bar(18);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 90 }}>
      <WordPop
        text="Built for the friend who always organizes."
        stagger={4}
        style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2, color: DIM, lineHeight: 1.15 }}
      />
      {frame >= localBars(1.5) && (
        <>
          <div style={{ height: 70 }} />
          <WordPop
            text="Every crew. Every city."
            delay={localBars(1.5)}
            style={{ fontSize: 110, fontWeight: 800, letterSpacing: -3 }}
            wordStyle={gradText}
          />
        </>
      )}
    </AbsoluteFill>
  );
};

// ── 5 · Close (bars 21–26) ──────────────────────────────────────────────────

const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localBars = (n: number) => bar(21 + n) - bar(21);

  const logoF = frame - localBars(2);
  const logoS = spring({ frame: logoF, fps, config: { damping: 13, stiffness: 200 } });
  const line1Out = interpolate(frame, [localBars(2) - 8, localBars(2)], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ opacity: line1Out, textAlign: 'center', position: 'absolute' }}>
        <WordPop text="One organizer." style={{ fontSize: 104, fontWeight: 800, letterSpacing: -3, color: '#fff' }} />
        <div style={{ height: 30 }} />
        <WordPop
          text="One perfect day."
          delay={beat(2)}
          style={{ fontSize: 104, fontWeight: 800, letterSpacing: -3 }}
          wordStyle={gradText}
        />
      </div>

      {logoF >= 0 && (
        <div style={{ position: 'absolute', textAlign: 'center', opacity: logoS, transform: `scale(${0.85 + 0.15 * logoS})` }}>
          <Img
            src={staticFile('brand/logo.png')}
            style={{
              width: 220,
              height: 220,
              display: 'block',
              margin: '0 auto',
              borderRadius: 62,
              boxShadow: '0 30px 90px rgba(236,108,201,0.45)',
            }}
          />
          <div style={{ marginTop: 46, fontSize: 96, fontWeight: 800, letterSpacing: -2, color: '#fff' }}>
            city<span style={{ ...gradText }}>Crew</span>
          </div>
          <div style={{ marginTop: 18, fontSize: 44, fontWeight: 500, color: FAINT }}>
            Plan your city days — together.
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ── root ────────────────────────────────────────────────────────────────────

export const PitchVertical: React.FC = () => {
  const frame = useCurrentFrame();
  const musicVolume = interpolate(frame, [DURATION - sec(1.8), DURATION], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: BG, fontFamily, color: '#fff' }}>
      <Audio src={staticFile(MUSIC_FILE)} startFrom={MUSIC_START_FROM} volume={() => musicVolume} />
      <Ambient />

      <Sequence durationInFrames={bar(6)}>
        <ProblemIntro />
      </Sequence>
      {SEGMENTS.map((seg, i) => (
        <Sequence key={seg.clip} from={bar(seg.fromBar)} durationInFrames={bar(seg.toBar) - bar(seg.fromBar)}>
          <DemoSegment seg={seg} index={i} />
        </Sequence>
      ))}
      <Sequence from={bar(18)} durationInFrames={bar(21) - bar(18)}>
        <Potential />
      </Sequence>
      <Sequence from={bar(21)} durationInFrames={bar(TOTAL_BARS) - bar(21)}>
        <Close />
      </Sequence>

      <Sequence from={bar(DROP_BAR)} durationInFrames={40}>
        <WowBurst />
      </Sequence>

      <Texture />
    </AbsoluteFill>
  );
};
