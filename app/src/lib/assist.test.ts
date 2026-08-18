import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('./testing').fakeSupabase> | null }));
vi.mock('./supabase', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

import {
  cachedNarration, derivedTitle, factLine, freshen, isEmptyAsk, narratableOf, narrate,
  narrationKey, parseAsk, prefetchNarration, resetNarrationCache,
  type Narratable, type Narration, type ParsedAsk,
} from './assist';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

/** English, so the assertions read as the strings a reader would see. */
const t = (en: string) => en;

const stop = (p: Partial<Narratable> & { slug: string }): Narratable => ({
  name: p.slug, arriveMin: 19 * 60, ...p,
});

const DRAFT = {
  company: 'couple', categories: ['eats'], when: 'evening' as const, where: 'Hoàn Kiếm',
};

describe('derivedTitle', () => {
  it('names the evening by where it opens', () => {
    expect(derivedTitle([stop({ slug: 'a', neighborhood: 'Hoàn Kiếm' })], 'evening', t))
      .toBe('An evening out in Hoàn Kiếm');
  });

  it('says a day out for a day', () => {
    expect(derivedTitle([stop({ slug: 'a', neighborhood: 'Tây Hồ' })], 'day', t))
      .toBe('A day out in Tây Hồ');
  });

  // The first stop is the one the reader pictures, not the commonest area.
  it('takes the area from the first stop that has one', () => {
    const stops = [stop({ slug: 'a' }), stop({ slug: 'b', neighborhood: 'Ba Đình' })];
    expect(derivedTitle(stops, 'evening', t)).toBe('An evening out in Ba Đình');
  });

  it('drops the place when no stop has an area', () => {
    expect(derivedTitle([stop({ slug: 'a' })], 'evening', t)).toBe('An evening out');
    expect(derivedTitle([], 'evening', t)).toBe('An evening out');
  });
});

describe('factLine', () => {
  // 2026-08-12 is a Wednesday; 03:00Z is 10:00 in Hanoi.
  const WED_10AM = new Date('2026-08-12T03:00:00Z');
  const week = (hours: string) =>
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      .map((d) => `${d}: ${hours}`);

  it('joins what is known and nothing else', () => {
    const line = factLine(
      stop({ slug: 'a', rating: 4.6, km: 2.14, openingHours: week('8:00 AM – 11:00 PM') }),
      WED_10AM, t,
    );
    expect(line).toBe('4.6★  ·  2.1 km  ·  open until 23:00');
  });

  it('says metres for anything under a kilometre', () => {
    expect(factLine(stop({ slug: 'a', km: 0.42 }), WED_10AM, t)).toBe('420 m');
  });

  it('says when a closed place opens', () => {
    expect(factLine(stop({ slug: 'a', openingHours: week('5:00 PM – 10:00 PM') }), WED_10AM, t))
      .toBe('opens 17:00');
  });

  // Unknown hours are not closed hours. A place that posts none — a public
  // park — must not be described either way.
  it('says nothing about hours it does not have', () => {
    expect(factLine(stop({ slug: 'a', rating: 4.2 }), WED_10AM, t)).toBe('4.2★');
    expect(factLine(stop({ slug: 'a', rating: 4.2, openingHours: [] }), WED_10AM, t)).toBe('4.2★');
  });

  it('says nothing at all about a row with nothing filled in', () => {
    expect(factLine(stop({ slug: 'a' }), WED_10AM, t)).toBe('');
  });

  // Round the clock: open, with no closing hour worth naming.
  it('leaves out a closing time there is none of', () => {
    expect(factLine(stop({ slug: 'a', openingHours: week('Open 24 hours') }), WED_10AM, t)).toBe('');
  });
});

const STOPS = [
  stop({ slug: 'bun-cha', name: 'Bún chả Hương Liên', neighborhood: 'Hoàn Kiếm', rating: 4.5 }),
  stop({ slug: 'lake-bar', name: 'Lake Bar', arriveMin: 21 * 60 }),
];

describe('narrate', () => {
  it('sends the plan and reads the answer back', async () => {
    fake().replies({
      data: {
        title: 'Lakeside and late noodles',
        stops: [{ slug: 'bun-cha', why: 'The queue moves fast at this hour.' }],
      },
    });
    const out = await narrate(STOPS, DRAFT, 'en');
    expect(out.title).toBe('Lakeside and late noodles');
    expect(out.why.get('bun-cha')).toBe('The queue moves fast at this hour.');
    expect(out.fromModel).toBe(true);

    const [call] = fake().log;
    expect(call.fn).toBe('plan-assist');
    const body = call.payload as { action: string; lang: string; stops: { slug: string; arrive: string }[] };
    expect(body.action).toBe('narrate');
    expect(body.lang).toBe('en');
    expect(body.stops.map((s) => s.slug)).toEqual(['bun-cha', 'lake-bar']);
    // The hour goes as a clock, not as minutes past midnight — the model is
    // being asked to write about an evening, not to do arithmetic.
    expect(body.stops[1].arrive).toBe('21:00');
  });

  // The third of three checks on this — the schema's enum, the function's
  // filter, and here. A place the reader never chose must not reach a screen
  // however many layers it gets past.
  it('drops a line about a place that is not in the plan', async () => {
    fake().replies({
      data: { title: 'x', stops: [{ slug: 'somewhere-else', why: 'Lovely.' }] },
    });
    expect((await narrate(STOPS, DRAFT, 'en')).why.size).toBe(0);
  });

  it('drops an empty sentence rather than printing a blank line', async () => {
    fake().replies({ data: { title: 'x', stops: [{ slug: 'bun-cha', why: '   ' }] } });
    expect((await narrate(STOPS, DRAFT, 'en')).why.size).toBe(0);
  });

  it('takes a name without lines, and lines without a name', async () => {
    fake().replies({ data: { title: 'Just a name', stops: [] } });
    const named = await narrate(STOPS, DRAFT, 'en');
    expect(named.title).toBe('Just a name');
    expect(named.fromModel).toBe(true);

    fake().replies({ data: { stops: [{ slug: 'lake-bar', why: 'One last drink by the water.' }] } });
    const lined = await narrate(STOPS, DRAFT, 'en');
    expect(lined.title).toBeNull();
    expect(lined.fromModel).toBe(true);
  });

  it('treats a blank title as no title', async () => {
    fake().replies({ data: { title: '  ', stops: [] } });
    const out = await narrate(STOPS, DRAFT, 'en');
    expect(out.title).toBeNull();
    expect(out.fromModel).toBe(false);
  });

  // Every failure lands in the same place, because the screen has one code
  // path and it is the one that also runs offline.
  it('is empty when the function refuses', async () => {
    fake().replies({ error: { message: 'not signed in' } });
    expect(await narrate(STOPS, DRAFT, 'en')).toEqual({ title: null, why: new Map(), fromModel: false });
  });

  it('is empty when the call never leaves the phone', async () => {
    fake().replies({ throws: new TypeError('Network request failed') });
    expect((await narrate(STOPS, DRAFT, 'en')).fromModel).toBe(false);
  });

  it('is empty when the model had nothing to say', async () => {
    fake().replies({ data: { title: null, stops: [] } });
    expect((await narrate(STOPS, DRAFT, 'en')).fromModel).toBe(false);
  });

  it('is empty when the answer has no body at all', async () => {
    fake().replies({ data: null });
    expect((await narrate(STOPS, DRAFT, 'en')).fromModel).toBe(false);
  });

  it('survives an answer with rubbish in the rows', async () => {
    fake().replies({ data: { title: 'x', stops: [{}, { slug: 'bun-cha' }] } });
    expect((await narrate(STOPS, DRAFT, 'en')).why.size).toBe(0);
  });

  it('survives an answer with no rows at all', async () => {
    fake().replies({ data: { title: 'Named, and nothing else' } });
    const out = await narrate(STOPS, DRAFT, 'en');
    expect(out.title).toBe('Named, and nothing else');
    expect(out.why.size).toBe(0);
  });

  // Nothing to narrate is not a failure, and it must not spend a request.
  it('asks nothing for an empty plan', async () => {
    expect((await narrate([], DRAFT, 'en')).fromModel).toBe(false);
    expect(fake().log).toHaveLength(0);
  });

  it('passes the answers through unchanged', async () => {
    fake().replies({ data: { title: 'x', stops: [] } });
    await narrate(STOPS, { ...DRAFT, company: null, where: null }, 'vi');
    const body = fake().log[0].payload as { draft: Record<string, unknown>; lang: string };
    expect(body.lang).toBe('vi');
    expect(body.draft).toEqual({
      company: null, categories: ['eats'], when: 'evening', where: null,
    });
  });

  it('sends the fields a thin catalog row leaves empty', async () => {
    fake().replies({ data: { title: 'x', stops: [] } });
    await narrate([stop({ slug: 'bare' })], DRAFT, 'en');
    const body = fake().log[0].payload as { stops: Record<string, unknown>[] };
    expect(body.stops[0]).toEqual({
      slug: 'bare', name: 'bare', categories: [], neighborhood: null, rating: null, arrive: '19:00',
    });
  });
});

// ── prose that stopped being true ────────────────────────────────────
//
// The bug these came from was on screen and in the database: a title
// reading "Three coffees around Hoàn Kiếm" over a plan with one café, and
// "A second stop to keep the conversation going" under what was by then
// the only stop.

const words = (over: Partial<Narration> = {}): Narration => ({
  title: 'Three coffees around Hoàn Kiếm',
  why: new Map([['a', 'An easy first stop at six.'], ['b', 'A second stop to keep it going.']]),
  fromModel: true,
  ...over,
});

describe('freshen', () => {
  it('keeps everything while nothing has moved', () => {
    const out = freshen(words(), ['a', 'b'], ['a', 'b']);
    expect(out.title).toBe('Three coffees around Hoàn Kiếm');
    expect([...out.why.keys()]).toEqual(['a', 'b']);
    expect(out.fromModel).toBe(true);
  });

  // The screenshot: two stops deleted, and a title still counting three.
  it('drops a title the reader has edited out from under', () => {
    expect(freshen(words(), ['a', 'b'], ['a']).title).toBeNull();
  });

  // "Coffee, then dinner" is a claim about sequence as much as content, so
  // the same stops in another order is a different evening.
  it('drops the title on a reorder, not only on a deletion', () => {
    expect(freshen(words(), ['a', 'b'], ['b', 'a']).title).toBeNull();
  });

  // The other half of the screenshot: the surviving stop is now first, and
  // its sentence still calls it the second.
  it('drops a line whose stop has moved', () => {
    const out = freshen(words(), ['a', 'b'], ['b']);
    expect(out.why.has('b')).toBe(false);
  });

  it('keeps a line whose stop stayed where it was', () => {
    const out = freshen(words(), ['a', 'b'], ['a', 'c']);
    expect(out.why.get('a')).toBe('An easy first stop at six.');
    expect(out.why.has('b')).toBe(false);
  });

  // A stop removed from above shifts everything below it, which is exactly
  // the case that produced the bug.
  it('drops the lines below a stop that was removed', () => {
    const three = words({ why: new Map([['a', 'one'], ['b', 'two'], ['c', 'three']]) });
    const out = freshen(three, ['a', 'b', 'c'], ['a', 'c']);
    expect(out.why.get('a')).toBe('one');
    expect(out.why.has('c')).toBe(false);
  });

  // `generated_by` is read off this, and a trip whose name and every line
  // are derived is a `rules` trip whatever was reached while making it.
  it('stops claiming a model once none of its words are left', () => {
    expect(freshen(words(), ['a', 'b'], ['z']).fromModel).toBe(false);
  });

  it('still claims a model while one sentence survives', () => {
    const out = freshen(words(), ['a', 'b'], ['a', 'z']);
    expect(out.title).toBeNull();
    expect(out.fromModel).toBe(true);
  });

  // The ordinary case before a model has answered, and the case where it
  // never will: nothing to keep, nothing to drop, and no claim either way.
  it('is quiet about a narration that never arrived', () => {
    const empty: Narration = { title: null, why: new Map(), fromModel: false };
    const out = freshen(empty, [], ['a']);
    expect(out.title).toBeNull();
    expect(out.why.size).toBe(0);
    expect(out.fromModel).toBe(false);
  });

  it('does not mutate what it was given', () => {
    const w = words();
    freshen(w, ['a', 'b'], ['a']);
    expect(w.title).toBe('Three coffees around Hoàn Kiếm');
    expect(w.why.size).toBe(2);
  });
});

const CATS = ['cafes', 'eats', 'views', 'heritage', 'nature', 'markets', 'nightlife'];
const AREAS = ['Hoàn Kiếm', 'Ba Đình', 'Tây Hồ'];
const OPTS = { today: '2026-08-17', categories: CATS, districts: AREAS };

const full = {
  ok: true,
  company: 'couple',
  categories: ['nightlife', 'eats'],
  district: 'Hoàn Kiếm',
  date: '2026-08-22',
  when: 'evening',
};

describe('parseAsk', () => {
  it('reads a sentence into wizard answers', async () => {
    fake().replies({ data: full });
    const out = await parseAsk('tối thứ Bảy này hai đứa đi ăn rồi kiếm chỗ uống', OPTS);
    expect(out).toEqual({
      company: 'couple',
      categories: ['eats', 'nightlife'],
      district: 'Hoàn Kiếm',
      date: '2026-08-22',
      when: 'evening',
    });
  });

  // The chip row has an order the reader recognises. The model returned
  // nightlife first; the screen must not reshuffle because of it.
  it('keeps the caller’s own chip order', async () => {
    fake().replies({ data: full });
    expect((await parseAsk('x', OPTS))!.categories).toEqual(['eats', 'nightlife']);
  });

  it('sends the vocabulary it wants back', async () => {
    fake().replies({ data: full });
    await parseAsk('  đi chơi  ', OPTS);
    const body = fake().log[0].payload as Record<string, unknown>;
    expect(fake().log[0].fn).toBe('plan-assist');
    expect(body.action).toBe('parse');
    // Trimmed: a trailing space is not part of what anyone typed.
    expect(body.text).toBe('đi chơi');
    expect(body.today).toBe('2026-08-17');
    expect(body.categories).toEqual(CATS);
    expect(body.districts).toEqual(AREAS);
  });

  // The third of three checks — the schema's enum, the function's filter,
  // and here. A chip reads as the reader's own choice, so a word the app has
  // no chip for must not be able to become one.
  it('drops every value the app has no chip for', async () => {
    fake().replies({
      data: {
        ok: true,
        company: 'colleagues',
        categories: ['karaoke', 'eats'],
        district: 'Somewhere Else',
        date: 'next Saturday',
        when: 'midnight',
      },
    });
    expect(await parseAsk('x', OPTS)).toEqual({
      company: null, categories: ['eats'], district: null, date: null, when: null,
    });
  });

  // `clampDay` owns the rule about days. A model that resolved a weekday
  // into the past hands back today rather than a plan nobody can go on.
  it('refuses a day in the past', async () => {
    fake().replies({ data: { ...full, date: '2026-08-10' } });
    expect((await parseAsk('x', OPTS))!.date).toBe('2026-08-17');
  });

  it('answers only the questions the sentence raised', async () => {
    fake().replies({
      data: { ok: true, company: null, categories: [], district: null, date: null, when: null },
    });
    const out = await parseAsk('kể chuyện gì đó vui đi', OPTS);
    expect(out).toEqual({ company: null, categories: [], district: null, date: null, when: null });
    expect(isEmptyAsk(out!)).toBe(true);
  });

  // `null` and an empty answer are different facts and the screen says
  // different things about them: "I could not read that" versus "that told
  // me nothing I could use".
  it('is null when the call fails, not an empty answer', async () => {
    fake().replies({ error: { message: 'not signed in' } });
    expect(await parseAsk('x', OPTS)).toBeNull();

    fake().replies({ throws: new TypeError('Network request failed') });
    expect(await parseAsk('x', OPTS)).toBeNull();

    fake().replies({ data: null });
    expect(await parseAsk('x', OPTS)).toBeNull();

    // What the function returns when the model refused or the call threw.
    fake().replies({ data: { ok: false } });
    expect(await parseAsk('x', OPTS)).toBeNull();
  });

  it('asks nothing for an empty sentence or an empty taxonomy', async () => {
    expect(await parseAsk('   ', OPTS)).toBeNull();
    expect(await parseAsk('x', { ...OPTS, categories: [] })).toBeNull();
    expect(fake().log).toHaveLength(0);
  });

  it('survives a reply with rubbish where the answers go', async () => {
    fake().replies({ data: { ok: true, categories: 'eats', date: 42 } });
    expect(await parseAsk('x', OPTS)).toEqual({
      company: null, categories: [], district: null, date: null, when: null,
    });
  });
});

describe('isEmptyAsk', () => {
  const none: ParsedAsk = {
    company: null, categories: [], district: null, date: null, when: null,
  };

  it('is true only when every answer is missing', () => {
    expect(isEmptyAsk(none)).toBe(true);
  });

  // One answer is enough to be worth filling in — that is the whole promise
  // of the box.
  it('is false as soon as one answer landed', () => {
    expect(isEmptyAsk({ ...none, company: 'solo' })).toBe(false);
    expect(isEmptyAsk({ ...none, categories: ['eats'] })).toBe(false);
    expect(isEmptyAsk({ ...none, district: 'Tây Hồ' })).toBe(false);
    expect(isEmptyAsk({ ...none, date: '2026-08-22' })).toBe(false);
    expect(isEmptyAsk({ ...none, when: 'day' })).toBe(false);
  });
});

describe('the narration cache', () => {
  const STOPS = [
    stop({ slug: 'bun-cha', arriveMin: 18 * 60 }),
    stop({ slug: 'lake-bar', arriveMin: 21 * 60 }),
  ];
  const REPLY = {
    data: { title: 'Lakeside', stops: [{ slug: 'bun-cha', why: 'Go early.' }] },
  };

  beforeEach(() => resetNarrationCache());

  // The key is what lets two screens ask about "the same plan" and mean
  // it. The hour is in it because the sentences lean on the hour; the
  // language because the sentences are in one.
  it('keys on the stops, their hours, and the language', () => {
    expect(narrationKey(STOPS, 'vi')).toBe('vi|bun-cha@1080,lake-bar@1260');
    expect(narrationKey(STOPS, 'en')).not.toBe(narrationKey(STOPS, 'vi'));
    expect(narrationKey([stop({ slug: 'bun-cha', arriveMin: 20 * 60 })], 'en'))
      .not.toBe(narrationKey([stop({ slug: 'bun-cha', arriveMin: 18 * 60 })], 'en'));
  });

  it('has nothing before anybody asks, and the answer after', async () => {
    expect(cachedNarration(STOPS, 'en')).toBeNull();
    fake().replies(REPLY);
    const out = await prefetchNarration(STOPS, DRAFT, 'en');
    expect(out.title).toBe('Lakeside');
    // The very object, not a copy: the editor's first render and the
    // prefetch's resolution must be the same words.
    expect(cachedNarration(STOPS, 'en')).toBe(out);
  });

  // The options screen fires three of these; an impatient tap on a card
  // fires a fourth with the same key. One call between them.
  it('joins an in-flight ask instead of repeating it', async () => {
    fake().replies(REPLY);
    const first = prefetchNarration(STOPS, DRAFT, 'en');
    const second = prefetchNarration(STOPS, DRAFT, 'en');
    expect(second).toBe(first);
    await first;
    expect(fake().log.filter((c) => c.op === 'invoke')).toHaveLength(1);
  });

  it('answers a settled ask from the cache, without the network', async () => {
    fake().replies(REPLY);
    const out = await prefetchNarration(STOPS, DRAFT, 'en');
    const again = await prefetchNarration(STOPS, DRAFT, 'en');
    expect(again).toBe(out);
    expect(fake().log.filter((c) => c.op === 'invoke')).toHaveLength(1);
  });

  // Empty is what an unreachable model produces, and it is cached like a
  // real answer on purpose: the editor's fallback has to be a state, not a
  // background retry that rewrites the screen when it lands.
  it('caches an empty answer so the fallback stays put', async () => {
    fake().replies({ error: { message: 'down' } });
    const out = await prefetchNarration(STOPS, DRAFT, 'en');
    expect(out.fromModel).toBe(false);
    expect(cachedNarration(STOPS, 'en')).toBe(out);
    await prefetchNarration(STOPS, DRAFT, 'en');
    expect(fake().log.filter((c) => c.op === 'invoke')).toHaveLength(1);
  });

  // Different language, different question — a Vietnamese reader must not
  // be handed the English sentences because English asked first.
  it('keeps languages apart', async () => {
    fake().replies(REPLY, { data: { title: 'Hồ Gươm', stops: [] } });
    await prefetchNarration(STOPS, DRAFT, 'en');
    const vi = await prefetchNarration(STOPS, DRAFT, 'vi');
    expect(vi.title).toBe('Hồ Gươm');
    expect(cachedNarration(STOPS, 'en')?.title).toBe('Lakeside');
  });

  // A session that regenerates all evening must not hoard every answer it
  // ever got. Insertion order is age for a Map, so the front goes first.
  it('lets the oldest answers go once it holds enough', async () => {
    fake().replies(REPLY);
    await prefetchNarration(STOPS, DRAFT, 'en');
    for (let i = 0; i < 12; i++) {
      fake().replies({ data: { title: `t${i}`, stops: [] } });
      await prefetchNarration([stop({ slug: `p-${i}` })], DRAFT, 'en');
    }
    expect(cachedNarration(STOPS, 'en')).toBeNull();
    expect(cachedNarration([stop({ slug: 'p-11' })], 'en')?.title).toBe('t11');
  });
});

// Three screens hand the planner's stops to the cache — the sketch to
// prefetch, the options to backstop, the editor to read. One mapper is
// what guarantees they produce the same key; a copy that drifted by one
// field would turn a hit into a miss, and a miss is indistinguishable
// from a slow model.
describe('narratableOf', () => {
  it('carries exactly what narrate asks about', () => {
    const out = narratableOf([{
      place: {
        slug: 'bun-cha', name_en: 'Bún chả Hàng Quạt', categories: ['eats'],
        neighborhood_en: 'Hoàn Kiếm', rating: 4.6, opening_hours: ['Monday: Closed'],
      },
      arriveMin: 18 * 60,
    }]);
    expect(out).toEqual([{
      slug: 'bun-cha', name: 'Bún chả Hàng Quạt', categories: ['eats'],
      neighborhood: 'Hoàn Kiếm', rating: 4.6, arriveMin: 18 * 60,
      openingHours: ['Monday: Closed'],
    }]);
  });

  it('produces the key the cache will look up', () => {
    const stops = narratableOf([
      { place: { slug: 'a', name_en: 'A' }, arriveMin: 540 },
      { place: { slug: 'b', name_en: 'B' }, arriveMin: 635 },
    ]);
    expect(narrationKey(stops, 'vi')).toBe('vi|a@540,b@635');
  });
});
