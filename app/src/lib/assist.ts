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
import { clockOf, openState } from './format';
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

/**
 * A planner stop in the shape `narrate` asks about.
 *
 * One function because three screens do this — the sketch prefetches, the
 * options screen backstops, the editor reads — and the cache key comes
 * from the result. Three hand-rolled copies only have to disagree by one
 * field for two screens to stop meaning the same plan, and nothing would
 * say so; a miss is indistinguishable from a slow model. Structural
 * `place` for the reason `Narratable` is: Node has to run this.
 */
export function narratableOf(stops: readonly {
  place: {
    slug: string; name_en: string; categories?: string[] | null;
    neighborhood_en?: string | null; rating?: number | null;
    opening_hours?: string[] | null;
  };
  arriveMin: number;
}[]): Narratable[] {
  return stops.map((s) => ({
    slug: s.place.slug,
    name: s.place.name_en,
    categories: s.place.categories,
    neighborhood: s.place.neighborhood_en,
    rating: s.place.rating,
    arriveMin: s.arriveMin,
    openingHours: s.place.opening_hours,
  }));
}

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
  if (state?.open && state.untilMin != null) {
    const at = clockOf(state.untilMin);
    bits.push(t(`open until ${at}`, `mở tới ${at}`, `${at}まで営業`));
  } else if (state && !state.open && state.opensAtMin != null) {
    const at = clockOf(state.opensAtMin);
    bits.push(t(`opens ${at}`, `mở lúc ${at}`, `${at}開店`));
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
          arrive: clockOf(s.arriveMin),
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

// ── asking early ─────────────────────────────────────────────────────
//
// The editor used to ask for the words on arrival: the plan rendered as
// facts, and up to four seconds later the model's sentences landed and the
// card rewrote itself in front of the reader. Reserving the lines' height
// stopped the layout jumping, but the *text* still changed — a screen that
// swaps its prose in after the reader has started reading it is answering
// a question they already moved past.
//
// So the options screen asks instead, for every card it shows, while the
// reader is still comparing them — and by the time one is tapped the words
// are usually here. This cache is the handoff: keyed by what was narrated,
// filled by whoever asks first, read synchronously by the editor on its
// first render.

/**
 * One narration, one key: the language, and the stops with their hours.
 *
 * The hour is in the key because the sentences lean on it — "an easy nine
 * o'clock start" is about 09:00, and a plan rebuilt to start at 20:15 must
 * not inherit it. Nothing else that varies (`seed`, the lens) is in the
 * key, because two plans with the same stops at the same hours *are* the
 * same plan as far as the words are concerned.
 */
export function narrationKey(stops: readonly Narratable[], lang: string): string {
  return `${lang}|${stops.map((s) => `${s.slug}@${s.arriveMin}`).join(',')}`;
}

// Module state, which `lib` otherwise avoids — but a cache that lived in a
// screen would die with it, and the whole point is to outlive the screen
// that filled it. `resetNarrationCache` exists so tests are not coupled
// through it.
const settled = new Map<string, Narration>();
const asking = new Map<string, Promise<Narration>>();

/** Four generations of three cards, roughly. Insertion order *is* age for
 *  a Map, so eviction is the front of the iterator; a session that
 *  regenerates all evening stays bounded. */
const KEEP = 12;

/** The words for exactly these stops, if somebody already asked. */
export function cachedNarration(
  stops: readonly Narratable[], lang: string,
): Narration | null {
  return settled.get(narrationKey(stops, lang)) ?? null;
}

/**
 * Ask the model now so a later screen does not have to.
 *
 * Joins rather than repeats: a second caller with the same key gets the
 * same in-flight promise, so the options screen and an impatient tap on a
 * card cost one call between them, not two.
 *
 * An empty answer is cached like a full one, deliberately. Empty is what
 * `narrate` returns when the model is unreachable, and caching it is what
 * makes the editor's fallback *stable* — the alternative is a screen that
 * opens on facts and then retries in the background, which is the exact
 * rewrite-under-the-reader this cache exists to end. The price is that one
 * failed generation stays flat until the plan itself changes; the next
 * Regenerate has new keys and asks fresh.
 */
export function prefetchNarration(
  stops: readonly Narratable[],
  draft: { company: string | null; categories: string[]; when: 'day' | 'evening'; where: string | null },
  lang: string,
): Promise<Narration> {
  const key = narrationKey(stops, lang);
  const done = settled.get(key);
  if (done) return Promise.resolve(done);
  const pending = asking.get(key);
  if (pending) return pending;
  const ask = narrate(stops, draft, lang).then((n) => {
    asking.delete(key);
    settled.set(key, n);
    while (settled.size > KEEP) settled.delete(settled.keys().next().value as string);
    return n;
  });
  asking.set(key, ask);
  return ask;
}

/** Tests only. A module-level cache is shared between test cases the way
 *  it is shared between screens, which is the one place that is not a
 *  feature. */
export function resetNarrationCache(): void {
  settled.clear();
  asking.clear();
}

/**
 * The narration, minus the parts the reader has since edited out from
 * under it.
 *
 * A model writes about the plan it was handed. Then the reader deletes a
 * stop, and the prose is still describing the plan that was: a title
 * reading "Three coffees around Hoàn Kiếm" over one café, and a line
 * reading "a second stop to keep the conversation going" under what is now
 * the only stop. Both were on screen, and one of them got saved into a
 * trip.
 *
 * Re-asking the model on every edit is the wrong fix and was rejected when
 * this was built: it costs a call per tap and flickers new prose under the
 * reader's finger. But not re-asking never meant *keeping* a sentence that
 * has stopped being true. Detecting that needs no model at all — it is a
 * comparison between the list that was narrated and the list on screen —
 * and what is dropped falls back to `factLine` and `derivedTitle`, which
 * are derived from the plan as it stands and cannot go stale.
 *
 * The title goes when the list changes **at all**, including order: "Coffee,
 * then dinner" is a claim about sequence as much as about content.
 *
 * A `why` goes when its stop moves, because position is what these
 * sentences lean on — "an easy first stop", "somewhere to end up". The
 * *hour* is deliberately not tracked, though a line may well mention it:
 * every arrival after an edited one shifts, so tracking the clock would
 * delete the whole narration for a fifteen-minute nudge. "At six" when it
 * is now 18:15 is a much smaller untruth than "a second stop" on the first
 * one, and paying for it with all of the prose is the worse trade.
 */
export function freshen(
  words: Narration,
  /** Slugs in the order they were sent to the model. */
  narrated: readonly string[],
  /** Slugs in the order they are on screen now. */
  current: readonly string[],
): Narration {
  const sameList = narrated.length === current.length
    && narrated.every((slug, i) => slug === current[i]);

  const why = new Map<string, string>();
  for (const [slug, line] of words.why) {
    if (narrated.indexOf(slug) === current.indexOf(slug)) why.set(slug, line);
  }

  const title = sameList ? words.title : null;
  // `fromModel` goes when the last of the prose goes, because it is what
  // `generated_by` on the saved trip is read from — and a trip whose name
  // and every line are derived is a `rules` trip whatever was reached while
  // making it. Any surviving sentence keeps it true.
  return { title, why, fromModel: words.fromModel && (title !== null || why.size > 0) };
}

// ── a sentence, turned into wizard answers ───────────────────────────
//
// **No screen calls this today.** The box it fed was removed from Ideas,
// and the reason is worth keeping here rather than only in the history:
// its output schema is exactly the four fields the chips already set, so
// it could never say anything the reader could not tap in one gesture —
// and it charged a network round trip and a model call for the privilege.
// A funnel whose mouth is no wider than the hand feeding it is a keyboard
// standing in for a finger.
//
// It is kept, tested and working, because the way back is not to write it
// again but to widen what it may answer: a budget, a tolerance for
// distance — things `planTrips` already reads (`budgetVnd`, `KM_PENALTY`)
// and the wizard has no chip to ask for. Then a sentence buys something.
// See the issue linked from `docs/ai-agent-planner.md`.
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
