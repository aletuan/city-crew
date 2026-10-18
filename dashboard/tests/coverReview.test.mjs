// Which covers the desk is asked to look at again, and what it is offered.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFoodPlace, qualifies, queue, reasons, reviewOf, tally, why } from '../src/coverReview.js';

const L = (kind, over = {}) => ({ kind, brand: false, wide: false, green: false, daylight: false, people: true, staged: false, ...over });
const photo = (id, labels, over = {}) => ({ id, photo_uri: `https://x/${id}.jpg`, is_cover: false, is_hidden: false, sort_order: 0, labels, ...over });
const place = (photos, over = {}) => ({ id: 'p1', slug: 'p1', city_id: 'hanoi', name: 'Place', categories: ['heritage'], photos, ...over });

test('a place is a food place when any of its categories is a café or a place to eat', () => {
  assert.equal(isFoodPlace(['heritage', 'cafes']), true);
  assert.equal(isFoodPlace(['eats']), true);
  assert.equal(isFoodPlace(['nightlife', 'views']), false);
  assert.equal(isFoodPlace(null), false);
});

test('an establishing view qualifies anywhere; the food only at a food place; nothing unlabelled', () => {
  for (const kind of ['exterior', 'interior', 'garden', 'heritage', 'view']) {
    assert.equal(qualifies(L(kind, { wide: true }), false), true, kind);
    assert.equal(qualifies(L(kind, { wide: false }), false), false, `${kind} but only part of it`);
    // "Can't tell" is not "yes".
    assert.equal(qualifies(L(kind, { wide: null }), true), false, `${kind}, wide unknown`);
  }
  assert.equal(qualifies(L('food'), true), true);
  assert.equal(qualifies(L('food'), false), false);
  assert.equal(qualifies(L('text', { wide: true }), true), false);
  assert.equal(qualifies(null, true), false);
});

test('the reasons are the criteria met, in the Threads skill\'s order', () => {
  assert.deepEqual(reasons(L('exterior', { wide: true, brand: true, daylight: true, people: false }), false),
    ['Whole place', 'Its sign', 'Daylight', 'No people']);
  assert.deepEqual(reasons(L('food', { people: null }), true), ['The food']);
  // A photograph that does not qualify names none of the first.
  assert.deepEqual(reasons(L('food', { daylight: true }), false), ['Daylight']);
});

test('why the cover does not qualify, in a few words', () => {
  assert.equal(why(null), 'Not labelled');
  assert.equal(why(L('interior')), 'Inside, but only part of it');
  assert.equal(why(L('garden')), 'Garden, but only part of it');
  assert.equal(why(L('heritage')), 'Heritage, but only part of it');
  assert.equal(why(L('food')), 'Food');
  assert.equal(why(L('text')), 'Text');
  assert.equal(why({ kind: 'diagram' }), 'diagram');
});

test('a cover that qualifies is never questioned, whatever scores higher beside it', () => {
  const p = place([
    photo('c', L('interior', { wide: true }), { is_cover: true }),
    photo('b', L('exterior', { wide: true, brand: true, daylight: true, people: false }), { sort_order: 1 }),
  ]);
  assert.equal(reviewOf(p), null);
});

test('at a café, a cover of the food stands; elsewhere it is asked about', () => {
  const photos = [
    photo('c', L('food'), { is_cover: true }),
    photo('b', L('exterior', { wide: true }), { sort_order: 1 }),
  ];
  assert.equal(reviewOf(place(photos, { categories: ['cafes'] })), null);
  const r = reviewOf(place(photos));
  assert.equal(r.cover.id, 'c');
  assert.equal(r.suggestion.id, 'b');
  assert.equal(r.why, 'Food');
  assert.deepEqual(r.reasons, ['Whole place']);
});

test('the suggestion is the qualifying photograph with most of the three criteria, then the earlier', () => {
  const p = place([
    photo('c', L('text'), { is_cover: true }),
    photo('one', L('interior', { wide: true, daylight: true }), { sort_order: 1 }),
    // Listed first, but later in the gallery: the gallery's order breaks
    // the tie, not the order the rows arrived in.
    photo('three-late', L('view', { wide: true, brand: true, daylight: true, people: false }), { sort_order: 5 }),
    photo('three', L('exterior', { wide: true, brand: true, daylight: true, people: false }), { sort_order: 4 }),
    photo('part', L('exterior', { brand: true, daylight: true, people: false }), { sort_order: 2 }),
  ]);
  assert.equal(reviewOf(p).suggestion.id, 'three');
});

test('hidden photographs are neither the cover the reader sees nor a suggestion', () => {
  const p = place([
    photo('c', L('text'), { is_cover: true }),
    photo('hidden', L('exterior', { wide: true }), { is_hidden: true }),
  ]);
  assert.equal(reviewOf(p), null);
  assert.equal(reviewOf(place([
    photo('c', L('text'), { is_cover: true, is_hidden: true }),
    photo('b', L('exterior', { wide: true })),
  ])), null);
});

test('no cover, two covers, or nothing better to offer: nothing to ask', () => {
  assert.equal(reviewOf(place([photo('b', L('exterior', { wide: true }))])), null);
  assert.equal(reviewOf(place([
    photo('c1', L('text'), { is_cover: true }), photo('c2', L('text'), { is_cover: true }),
    photo('b', L('exterior', { wide: true })),
  ])), null);
  assert.equal(reviewOf(place([photo('c', L('text'), { is_cover: true }), photo('b', L('food'))])), null);
});

test('the queue drops a place kept with this same cover, asks again once its cover changed, and sorts by city then name', () => {
  const ask = (id, city, name, cover = 'c') => place([
    photo(cover, L('text'), { is_cover: true }),
    photo(`${id}-b`, L('exterior', { wide: true })),
  ], { id, city_id: city, name });
  const places = [
    ask('a', 'hue', 'Zen'),
    ask('b', 'hanoi', 'Bờ Hồ'),
    ask('c', 'hanoi', 'An'),
    ask('k', 'hanoi', 'Kept', 'c'),
    ask('m', 'hanoi', 'Moved', 'new-cover'),
    place([photo('ok', L('view', { wide: true }), { is_cover: true })], { id: 'fine' }),
  ];
  const answers = [
    { place_id: 'k', cover_photo_id: 'c', decision: 'kept' },
    { place_id: 'm', cover_photo_id: 'old-cover', decision: 'kept' },
    { place_id: 'a', cover_photo_id: 'c', decision: 'changed' },
  ];
  assert.deepEqual(queue(places, answers).map((r) => r.place.id), ['c', 'b', 'm', 'a']);
});

test('the tally is how many suggestions were taken and how many kept', () => {
  assert.deepEqual(tally([]), { changed: 0, kept: 0, total: 0 });
  assert.deepEqual(tally([{ decision: 'changed' }, { decision: 'kept' }, { decision: 'changed' }]),
    { changed: 2, kept: 1, total: 3 });
});
