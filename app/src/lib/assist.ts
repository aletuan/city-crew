// Asking a model to name the evening, and what to print when it doesn't.
//
// The planner has already decided everything that matters — which places,
// in what order, at what hour. This file only adds words, and the reason it
// is worth its own module is the half nobody tests: **what the screen shows
// when the model is unreachable.**
//
// So the fallback is not an error state. `derivedTitle` and `factLine`
// produce a complete, honest plan out of the catalog alone: "Saturday
// evening in Hoàn Kiếm", "4.6★ · 2.1 km away · open until 23:00". A reader
// with no network gets a plan that reads slightly flatter, not a plan with
// holes in it — which is why `narrate` never throws and never returns null.
//
// The key lives in Supabase function settings, so the call goes through
// `plan-assist` rather than straight to the API; see that function for why
// the model is never allowed to choose a place.

import { supabase } from './supabase';
import { clampDay } from './day';
import { openState } from './format';
import { COMPANY, type Company } from './trip';

/** What the screen has to hand about a stop, in the shape both halves of
 *  this file need. Structural rather than `Place` for the reason
 *  `itinerary.ts` is: a Node process has to be able to run the tests. */
export type Narratable = {
  slug: string;
  name: string;
  categories?: string[] | null;
  neighborhood?: string | null;
  rating?: number | null;
  /** Minutes past midnight, as the planner set it. */
  arriveMin: number;
  openingHours?: string[] | null;
  /** Kilometres from where the reader is, when that is known. */
  km?: number | null;
};

export type Narration = {
  title: string | null;
  /** Slug → the sentence. Sparse: a stop the model skipped is simply
   *  absent, and the screen falls back for that row alone. */
  why: Map<string, string>;
  /** True when a model actually wrote this. Drives `generated_by` on the
   *  saved trip, so a reader can tell where the prose came from. */
  fromModel: boolean;
};

const clock = (minutes: number) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * The name to print when no model named it.
 *
 * Built from the two things a reader would use themselves: when it is and
 * where it is. The neighbourhood comes from the first stop rather than the
 * commonest one — a plan is read top-down, and the place it opens in is the
 * one the reader pictures.
 *
 * `dateline` is not reused here: this is a name, not a date, and "Thứ Bảy,
 * 16 tháng 8 ở Hoàn Kiếm" is a sentence rather than a title.
 */
export function derivedTitle(
  stops: readonly Narratable[],
  when: 'day' | 'evening',
  t: (en: string, vi: string, ja: string) => string,
): string {
  const where = stops.find((s) => !!s.neighborhood)?.neighborhood;
  const part = when === 'day'
    ? t('A day out', 'Một ngày đi chơi', '一日おでかけ')
    : t('An evening out', 'Một buổi tối', '夜のおでかけ');
  if (!where) return part;
  return t(`${part} in ${where}`, `${part} ở ${where}`, `${where}の${part}`);
}

/**
 * The line to print under a stop when no model wrote one.
 *
 * Facts, joined — never a sentence pretending to be one. A reader can tell
 * the difference between "4.6★ · 2.1 km · open until 23:00" and prose, and
 * the honest version of "we have nothing to say about this place" is to
 * show them what we do know rather than to generate around it.
 *
 * `now` is a parameter for the reason it is everywhere else in this repo: a
 * function that reads the clock itself cannot be tested.
 */
export function factLine(
  stop: Narratable,
  now: Date,
  t: (en: string, vi: string, ja: string) => string,
): string {
  const bits: string[] = [];
  if (stop.rating) bits.push(`${stop.rating}★`);
  if (stop.km != null) {
    bits.push(stop.km < 1
      ? `${Math.round(stop.km * 1000)} m`
      : `${Math.round(stop.km * 10) / 10} km`);
  }
  const state = openState(stop.openingHours, now);
  // `null` from `openState` means the hours are unknown, which is not the
  // same as closed and must not be printed as either.
  if (state?.open && state.until) {
    bits.push(t(`open until ${state.until}`, `mở tới ${state.until}`, `${state.until}まで営業`));
  } else if (state && !state.open && state.opensAt) {
    bits.push(t(`opens ${state.opensAt}`, `mở lúc ${state.opensAt}`, `${state.opensAt}開店`));
  }
  return bits.join('  ·  ');
}

/** What `plan-assist` answers with, before any of it is believed. */
type Reply = {
  data?: { title?: unknown; stops?: { slug?: unknown; why?: unknown }[] } | null;
  error?: { message?: string } | null;
};

/**
 * The narration for a plan, or the empty one.
 *
 * Never throws and never rejects. Every failure — signed out, no network,
 * the function missing, a model that refused — arrives here as the same
 * empty `Narration`, and the screen renders its fallback without knowing
 * which of those happened. That is the whole contract: the caller has one
 * code path, and it is the one that also runs offline.
 *
 * Slugs are checked against the stops that were sent. The function checks
 * too, and the schema checked before that; this is the third and cheapest
 * place to stop a place the reader never chose from reaching their screen.
 */
export async function narrate(
  stops: readonly Narratable[],
  draft: { company: string | null; categories: string[]; when: 'day' | 'evening'; where: string | null },
  lang: string,
): Promise<Narration> {
  const empty: Narration = { title: null, why: new Map(), fromModel: false };
  if (!stops.length) return empty;

  let reply: Reply;
  try {
    reply = await supabase.functions.invoke('plan-assist', {
      body: {
        action: 'narrate',
        lang,
        draft: {
          company: draft.company,
          categories: draft.categories,
          when: draft.when,
          where: draft.where,
        },
        stops: stops.map((s) => ({
          slug: s.slug,
          name: s.name,
          categories: s.categories ?? [],
          neighborhood: s.neighborhood ?? null,
          rating: s.rating ?? null,
          arrive: clock(s.arriveMin),
        })),
      },
    });
  } catch {
    // supabase-js reports a refused call in `error` and a broken one — no
    // network, the request never leaving the phone — by throwing.
    return empty;
  }
  if (reply.error || !reply.data) return empty;

  const allowed = new Set(stops.map((s) => s.slug));
  const why = new Map<string, string>();
  for (const row of reply.data.stops ?? []) {
    const slug = String(row?.slug ?? '');
    const line = String(row?.why ?? '').trim();
    if (allowed.has(slug) && line) why.set(slug, line);
  }

  const title = typeof reply.data.title === 'string' && reply.data.title.trim()
    ? reply.data.title.trim()
    : null;

  // A reply with a name but no lines, or lines but no name, is still a
  // model's work — `fromModel` says whether one spoke at all, and the
  // screen falls back per field rather than all-or-nothing.
  return { title, why, fromModel: !!title || why.size > 0 };
}

// ── a sentence, turned into wizard answers ───────────────────────────
//
// The other direction, and the failure shape is deliberately different.
//
// `narrate` failing costs prose the reader never asked for, so it fails
// silently into a fallback. `parseAsk` failing means the box they typed a
// sentence into did nothing — and a box that silently does nothing is worse
// than one that says it could not read that. So this returns `null` rather
// than an empty answer, and the screen tells them.
//
// Nothing here is a plan. The result is wizard answers, which the reader
// can see and change before pressing anything, and which then go through
// the same `planTrips` every hand-tapped answer goes through.

/** What the wizard can be pre-filled with. Every field is separately
 *  unknown: a sentence naming only an evening answers one question and
 *  must not be made to look like it answered five. */
export type ParsedAsk = {
  company: Company | null;
  categories: string[];
  district: string | null;
  /** `YYYY-MM-DD`, already clamped — never a day in the past. */
  date: string | null;
  when: 'day' | 'evening' | null;
};

/** True when the sentence produced nothing at all. The screen needs this to
 *  tell "I read it and it said nothing useful" apart from "I could not
 *  reach the model", which is `null` from `parseAsk`. */
export function isEmptyAsk(a: ParsedAsk): boolean {
  return !a.company && !a.categories.length && !a.district && !a.date && !a.when;
}

/**
 * Wizard answers read out of one sentence, or `null` when nothing could be
 * read at all.
 *
 * Every value is checked against the vocabulary that was sent, a second
 * time, after the function checked it and after the schema's `enum`
 * constrained it. Three layers for the reason `narrate` has three: a chip on
 * this screen reads as the reader's own choice, and a word the app has no
 * chip for must not be able to become one.
 *
 * `today` is a parameter rather than read here, like everywhere else in this
 * repo — and it does double duty, because the model has no clock and it is
 * also what "thứ Bảy này" gets resolved against.
 */
export async function parseAsk(
  text: string,
  opts: { today: string; categories: readonly string[]; districts: readonly string[] },
): Promise<ParsedAsk | null> {
  const sentence = text.trim();
  if (!sentence || !opts.categories.length) return null;

  let reply: { data?: Record<string, unknown> | null; error?: { message?: string } | null };
  try {
    reply = await supabase.functions.invoke('plan-assist', {
      body: {
        action: 'parse',
        text: sentence,
        today: opts.today,
        categories: [...opts.categories],
        districts: [...opts.districts],
      },
    });
  } catch {
    return null;
  }
  if (reply.error || !reply.data || reply.data.ok !== true) return null;

  const d = reply.data;
  const one = <T extends string>(v: unknown, allowed: readonly T[]): T | null => (
    typeof v === 'string' && (allowed as readonly string[]).includes(v) ? v as T : null
  );

  // Filtered through the caller's own order, not the model's. The chip row
  // has an order the reader recognises, and a pre-filled row that came back
  // shuffled would read as a different screen.
  const categories = opts.categories.filter(
    (c) => Array.isArray(d.categories) && d.categories.includes(c),
  );

  return {
    company: one(d.company, COMPANY.map((c) => c.key)),
    categories,
    district: one(d.district, opts.districts),
    // Shape first, then the rule. `clampDay` answers "is this day allowed"
    // and lives in `day.ts`, so a date resolved into last Tuesday comes back
    // as today rather than as a plan nobody can go on — but it answers
    // *today* to anything it cannot read at all, and "next Saturday" turning
    // silently into today is a filled-in chip nobody chose. Unreadable is
    // null, and the reader picks the day themselves.
    date: typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date)
      ? clampDay(d.date, opts.today)
      : null,
    when: one(d.when, ['day', 'evening'] as const),
  };
}
