// The itinerary generator, run the way the mockup runs it.
//
// `itinerary-runtime.js` is not a module. It is ES5 pasted into the
// mockup page, where it reads `PLACES` off the page and writes a plan
// into the page's elements. So the test does what the page does: builds
// a context holding a small catalog and a document that remembers what
// was written, evaluates the file in it, and reads the plan back out.
//
// What the file promises, in its own header, is the property worth
// pinning: same inputs and same data give the same plan, because the
// pitch recorder depends on it. The rest are the rules a reader would
// notice broken — meals only at eateries, a plan that fits the budget
// when a cheaper stop exists, the day's length setting the stop count.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'itinerary-runtime.js'),
  'utf8',
);

const place = (id, cat, over = {}) => ({
  id, cat, en: id, vi: id, loc_en: 'D1', loc_vi: 'Q1', vibes: [], rating: 4.5, rc: 100,
  price_vnd: 100000, price: '100k₫', dur_min: 60, dur_max: 90, ...over,
});

/** A catalog small enough to reason about, with one obvious best pick
 *  per slot and a cheap alternative for the budget pass. */
const catalog = () => ({
  food: [
    place('pho-hoa', 'food', { vibes: ['food_tour'], rating: 4.7, rc: 5000, price_vnd: 60000 }),
    place('banh-mi', 'food', { vibes: ['food_tour'], rating: 4.4, rc: 900, price_vnd: 30000 }),
    place('fine-dining', 'food', { vibes: ['food_tour', 'romantic'], rating: 4.8, rc: 2000, price_vnd: 900000 }),
  ],
  out: [
    place('workshop-cafe', 'out', { vibes: ['cafes', 'chill'], rating: 4.6, rc: 3000, price_vnd: 60000 }),
    place('war-museum', 'out', { vibes: ['culture'], rating: 4.5, rc: 20000, price_vnd: 40000 }),
    place('rooftop', 'out', { vibes: ['views', 'nightlife'], rating: 4.4, rc: 1500, price_vnd: 250000 }),
    place('park', 'out', { vibes: ['outdoors', 'chill'], rating: 4.3, rc: 800, price_vnd: 0 }),
  ],
});

/** The page: a catalog, and elements that remember what was put in them. */
function page(places = catalog()) {
  const els = {};
  const el = (id) => (els[id] ??= { innerHTML: '', textContent: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } });
  const document = {
    getElementById: (id) => el(id),
    querySelectorAll: () => [],
  };
  const ctx = vm.createContext({
    PLACES: places, CITIES: [{ id: 'hcmc', short_en: 'Saigon', short_vi: 'Sài Gòn' }], CITY: 'hcmc',
    document, Math, parseFloat, String,
  });
  vm.runInContext(SOURCE, ctx);
  return { ctx, els, el };
}

const inputs = (over = {}) => ({ vibes: ['cafes', 'food_tour', 'views'], hours: 12, budget: 750000, people: 5, day: 'sat', ...over });

/** The stop names, in order, read back out of the rendered plan. */
const stopsOf = (p) => [...p.el('iti-stops').innerHTML.matchAll(/<b><span data-lang-en="">([^<]+)<\/span>/g)].map((m) => m[1]);

test('formats đồng the way the mockup does', () => {
  const { ctx } = page();
  assert.equal(ctx.itiFmtVnd(0), '0₫');
  assert.equal(ctx.itiFmtVnd(45000), '45k₫');
  assert.equal(ctx.itiFmtVnd(1000000), '1M₫');
  assert.equal(ctx.itiFmtVnd(1250000), '1.3M₫');
});

test('writes a clock that wraps past midnight', () => {
  const { ctx } = page();
  assert.equal(ctx.itiTime(600), '10:00');
  assert.equal(ctx.itiTime(690), '11:30');
  assert.equal(ctx.itiTime(1500), '01:00');
});

test('the same inputs and the same data give the same plan', () => {
  const a = page(); a.ctx.generatePlan(inputs());
  const b = page(); b.ctx.generatePlan(inputs());
  assert.deepEqual(stopsOf(a), stopsOf(b));
  assert.equal(a.el('iti-stops').innerHTML, b.el('iti-stops').innerHTML);
  assert.equal(a.el('iti-total').textContent, b.el('iti-total').textContent);
  assert.ok(stopsOf(a).length > 0, 'a plan was made at all');
});

test('a day of twelve hours has six stops, a short one has two', () => {
  const long = page(); long.ctx.generatePlan(inputs({ hours: 12 }));
  const short = page(); short.ctx.generatePlan(inputs({ hours: 4 }));
  assert.equal(stopsOf(long).length, 6);
  assert.equal(stopsOf(short).length, 2);
});

test('meals are eaten at eateries, and a stop is used once', () => {
  const p = page(); p.ctx.generatePlan(inputs({ hours: 12 }));
  const stops = stopsOf(p);
  const meals = stops.filter((s) => catalog().food.some((f) => f.id === s));
  assert.equal(meals.length, 2, `two meal slots, got ${meals.length} eateries in ${stops}`);
  assert.equal(new Set(stops).size, stops.length, 'a place appears twice');
});

test('a tight budget swaps the dearest stop for a cheaper one', () => {
  const dear = page(); dear.ctx.generatePlan(inputs({ hours: 4, budget: 100000000 }));
  const tight = page(); tight.ctx.generatePlan(inputs({ hours: 4, budget: 150000 }));
  // With money to spare the evening meal is fine dining; without, it is not.
  assert.ok(stopsOf(dear).includes('fine-dining'), `expected fine dining in ${stopsOf(dear)}`);
  assert.ok(!stopsOf(tight).includes('fine-dining'), `fine dining survived a tight budget: ${stopsOf(tight)}`);
});

test('the header names the day and the city in both languages', () => {
  const p = page(); p.ctx.generatePlan(inputs({ day: 'sun', people: 3 }));
  assert.equal(p.el('iti-title-en').textContent, 'Sunday in Saigon');
  assert.equal(p.el('iti-title-vi').textContent, 'Chủ Nhật ở Sài Gòn');
  assert.equal(p.el('iti-org-vi').textContent, 'Bạn tổ chức · 3 người');
  assert.equal(p.el('iti-window-en').textContent, 'Saigon · 10:00–22:00');
});

test('an empty catalog makes no plan and does not throw', () => {
  const p = page({ food: [], out: [] });
  assert.doesNotThrow(() => p.ctx.generatePlan(inputs()));
  assert.equal(p.el('iti-stops').innerHTML, '');
});
