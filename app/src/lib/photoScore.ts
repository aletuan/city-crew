// A photograph's score, whichever model read it (owner, 15–16 Oct 2026).
//
// A scorer reads a photograph and hands back a `Reading`: one overall
// number on −1…1, whether the photograph is a record rather than a
// picture (or null, where it has no opinion), and measurements of its
// own. What is true of every scorer is here: the 0–10 the guide sees and
// its word, which photographs still need reading, the run that reads
// them, the best of them. What only one scorer knows — what its
// measurements mean and how to say them — is its `Interpreter`, found in
// `SCORERS` by the name the row carries.
//
// ── scorers ──
//
// Apple Vision on the phone is the only one: `photoScoreNative.ts`
// reaches its module, `photoScoreVision.ts` reads what it measured. A
// second — a model on a server, a later Apple model, the in-app camera —
// is a `PhotoScorer` that reads, an `Interpreter` added to `SCORERS`,
// and the migration that drops `photo_scores_one_per_photo`; no screen
// changes. Which scorer's rows the gallery shows is `SHOWN`, one name,
// because a guide comparing two numbers for one photograph is a screen
// nobody has asked for.
//
// ── score once ──
//
// A photograph is read once per scorer. Each scorer's `version` is what
// lets that change deliberately: a row below it counts as unread, so a
// better reading of the old rows is one number, not a migration.

import type Ionicons from '@expo/vector-icons/Ionicons';
import { appleVision } from './photoScoreVision';

/** The measurements, as a scorer hands them over and the row keeps
 *  them. Each scorer's own, on its own scales: the fields named here are
 *  what Apple Vision reports, and what they mean is
 *  `photoScoreVision.ts`'s to say. Every field optional: a later scorer
 *  may carry others, and an image Vision could not see into, fewer. */
export type Signals = {
  /** The original's pixels, before the module scaled it down. */
  width?: number;
  height?: number;
  /** Mean luma, 0 (black) to 1 (white). */
  brightness?: number;
  /** Share of pixels crushed under 5% and blown over 95%. */
  shadows?: number;
  highlights?: number;
  /** Variance of the Laplacian on a 512-pixel grey copy: high is crisp. */
  sharpness?: number;
  /** The salient region's centre (top-left origin, 0–1) and its area. */
  subject?: { x: number; y: number; area: number };
  /** Degrees off level, signed. Absent when Vision found no horizon. */
  tilt?: number;
  people?: number;
  /** The largest person's share of the frame. */
  peopleArea?: number;
  textLines?: number;
  /** All the writing's share of the frame, summed. Kept, not judged on —
   *  see `TEXT_LINES` for why one false box makes it unreliable. */
  textArea?: number;
  /** Vision's five most confident labels from 0.1 up. */
  labels?: { id: string; p: number }[];
};

/** What a scorer hands back for one photograph. `isUtility` is null
 *  from a scorer with no opinion on records; Apple Vision always has one. */
export type Reading = { aesthetic: number; isUtility: boolean | null; signals: Signals };

/** A row of `photo_scores`, as the gallery reads it. */
export type PhotoScore = {
  /** Which scorer read it — a key of `SCORERS`. */
  scorer: string;
  scorer_version: number;
  aesthetic: number | null;
  is_utility: boolean | null;
  signals: Signals;
};

export type T = (en: string, vi: string, ja?: string) => string;

/** A scorer by name and by the version of its reading. */
export type ScorerKey = { id: string; version: number };

/** A model that reads a photograph; the row it leaves is stamped with
 *  `id` and `version`. Apple Vision's is `photoScoreNative`'s. */
export type PhotoScorer = ScorerKey & { read: (uri: string) => Promise<Reading> };

/**
 * One measured quality of a photograph, as the detailed analysis lists
 * it: what it is, what was measured, whether it helped, and a bar. Not a
 * score out of ten — a row that said "Composition 9.1" would be
 * inventing one (owner, 16 Oct 2026). Each bar is a measurement the
 * interpreter can name; a quality nothing measures has no row at all
 * (colour and space, 17 Oct 2026: see `docs/photo-critic.md`, D12).
 */
export type Detail = {
  key: string;
  label: string;
  /** The quality's own mark, drawn before its name — what the row is
   *  about, not how it went; the value's ink says that. */
  icon: keyof typeof Ionicons.glyphMap;
  /** What was measured, in words. */
  value: string;
  tone: 'good' | 'warn' | 'plain';
  /** How full the row's bar is, 0–1, higher better. What it measures is
   *  the row's own and is said where the row is made — never a score out
   *  of ten that nothing measured. */
  bar: number;
};

/** One thing that would have helped, under the mark of the quality it
 *  would have helped. */
export type Tip = { icon: Detail['icon']; text: string };

/** What the app knows of one scorer's rows: how to say them. */
export type Interpreter = ScorerKey & {
  /** The line saying who measured. */
  source: (t: T) => string;
  /** The sentence under the number: why. */
  explain: (score: Pick<PhotoScore, 'is_utility' | 'signals'>, t: T) => string;
  /** The measured qualities, one row each. */
  details: (score: Pick<PhotoScore, 'is_utility' | 'signals'>, t: T) => Detail[];
  /** What would have helped, one line per thing that held it back. */
  suggestions: (score: Pick<PhotoScore, 'is_utility' | 'signals'>, t: T) => Tip[];
  /** Where the photograph's number stands among this scorer's rows in
   *  the catalog, 0–1; null when it has none. */
  standing: (score: Pick<PhotoScore, 'aesthetic'>) => number | null;
};

/** Every scorer whose rows the app can put into words, by name. */
const SCORERS: ReadonlyMap<string, Interpreter> = new Map([[appleVision.id, appleVision]]);

/** The scorer whose rows the gallery reads, shows and fills. */
export const SHOWN: ScorerKey = appleVision;

/** How a row's scorer says it; undefined for a name this build does not
 *  know — a row a later app wrote, read by an older one. */
export function interpreterOf(scorer: string): Interpreter | undefined {
  return SCORERS.get(scorer);
}

/** A photograph with no reading by this scorer, or only an older one. */
export function needsScore(score: PhotoScore | null | undefined, scorer: ScorerKey): boolean {
  return !score || score.scorer !== scorer.id || score.scorer_version < scorer.version;
}

/**
 * Out of ten, one decimal: the owner's scale. Linear on the scorer's −1…1,
 * so the stored number and the shown one are the same fact, and a later
 * change of mind about the curve is a change here, not in the rows.
 */
export function toTen(aesthetic: number): number {
  const clamped = Math.max(-1, Math.min(1, aesthetic));
  return Math.round((clamped + 1) * 50) / 10;
}

export type Band = 'excellent' | 'good' | 'fair' | 'weak';

/**
 * The word beside the number. Four, because a gallery needs to say
 * "cover material", "fine", "keep if you must" and "consider removing",
 * and a fifth is a distinction nobody acts on. The cuts are first
 * guesses, like Vision's thresholds (`photoScoreVision.ts`), set so
 * that the middle of the range (around 0, a 5) reads as fair rather
 * than as failing.
 */
export function band(ten: number): Band {
  if (ten >= 8) return 'excellent';
  if (ten >= 6.5) return 'good';
  if (ten >= 5) return 'fair';
  return 'weak';
}

export function bandLabel(b: Band, t: T): string {
  return {
    excellent: t('Very good', 'Rất tốt', 'とても良い'),
    good: t('Good', 'Tốt', '良い'),
    fair: t('Fair', 'Khá', 'まずまず'),
    weak: t('Weak', 'Chưa tốt', 'いまひとつ'),
  }[b];
}

/**
 * Reads each photograph in turn and keeps each answer as it comes, so
 * stopping halfway keeps the half (owner: Cancel keeps what was scored).
 * One at a time: Vision is already using the phone's neural engine, and
 * two at once would finish no sooner. A photograph that fails is counted
 * and passed over — one unreadable Google URL is no reason to stop the
 * other five.
 */
export async function scoreAll<P extends { id: string; photo_uri: string }>(
  todo: readonly P[],
  io: {
    read: (uri: string) => Promise<Reading>;
    save: (photoId: string, reading: Reading) => Promise<void>;
    /** After each photograph, however it went: how many are behind us. */
    onStep: (done: number) => void;
    stopped: () => boolean;
  },
): Promise<{ scored: number; failed: number }> {
  let scored = 0;
  let failed = 0;
  for (const p of todo) {
    if (io.stopped()) break;
    try {
      await io.save(p.id, await io.read(p.photo_uri));
      scored += 1;
    } catch {
      failed += 1;
    }
    io.onStep(scored + failed);
  }
  return { scored, failed };
}

/** The best-read photograph of those with a score, for the card that
 *  closes a run; null when none has one. */
export function bestOf<P extends { score?: PhotoScore | null }>(photos: readonly P[]): { photo: P; ten: number } | null {
  let best: { photo: P; ten: number } | null = null;
  for (const p of photos) {
    if (p.score?.aesthetic == null) continue;
    const ten = toTen(p.score.aesthetic);
    if (!best || ten > best.ten) best = { photo: p, ten };
  }
  return best;
}
