// The loader is the only thing between the desk and a blank rectangle.
//
// Two screens ask for the Google Maps script independently — Coverage and
// PlaceEditor — and the API is not idempotent: load its script twice and it
// logs "You have included the Google Maps JavaScript API multiple times",
// then behaves in ways nobody wants to debug. So "exactly one <script>, no
// matter who asks or how often" is the property worth pinning down.
//
// The other property is that a missing or rejected key is *not* an error
// here. The desk works without a map: Coverage still draws its bubbles,
// PlaceEditor still shows coordinates. A loader that throws would take both
// screens down over a basemap.
//
// `document` and `window` are injected rather than read off the global so
// this runs under node:test with no DOM. Each test re-imports the module
// with a cache-busting query string, because the loader caches its promise
// on purpose — without a fresh specifier, test two would see test one's.
import { test } from 'node:test';
import assert from 'node:assert/strict';

let n = 0;
const loadModule = () => import(`../src/lib/googleMaps.js?t=${n++}`);

/** A DOM small enough to fit in the head, recording what was appended. */
function fakeDom() {
  const scripts = [];
  const win = {};
  const doc = {
    createElement: () => ({ set src(v) { this._src = v; }, get src() { return this._src; } }),
    head: { appendChild: (el) => scripts.push(el) },
  };
  return { doc, win, scripts };
}

test('no key means no map and no error — the desk keeps working', async () => {
  const { loadGoogleMaps } = await loadModule();
  const { doc, win, scripts } = fakeDom();
  assert.equal(await loadGoogleMaps({ key: '', doc, win }), null);
  assert.equal(scripts.length, 0, 'nothing injected without a key');
});

test('two screens asking share one script and one promise', async () => {
  const { loadGoogleMaps } = await loadModule();
  const { doc, win, scripts } = fakeDom();

  const first = loadGoogleMaps({ key: 'k', doc, win });
  const second = loadGoogleMaps({ key: 'k', doc, win });
  assert.equal(scripts.length, 1, 'one <script> for both callers');

  const maps = { Map: function Map() {} };
  win.google = { maps };
  win[scripts[0].src.match(/callback=([^&]+)/)[1]]();

  assert.equal(await first, maps);
  assert.equal(await second, maps, 'the second caller got the same promise');
});

test('the script carries the key and asks for the async loading path', async () => {
  const { loadGoogleMaps } = await loadModule();
  const { doc, win, scripts } = fakeDom();
  loadGoogleMaps({ key: 'abc123', doc, win });

  const { src } = scripts[0];
  assert.ok(src.startsWith('https://maps.googleapis.com/maps/api/js?'), src);
  assert.match(src, /[?&]key=abc123(&|$)/);
  assert.match(src, /[?&]loading=async(&|$)/);
  assert.equal(scripts[0].async, true);
});

test('a script that fails to load resolves null rather than rejecting', async () => {
  const { loadGoogleMaps } = await loadModule();
  const { doc, win, scripts } = fakeDom();
  const pending = loadGoogleMaps({ key: 'k', doc, win });
  scripts[0].onerror();
  assert.equal(await pending, null);
});

test('an API already on the page is used as is, not loaded again', async () => {
  const { loadGoogleMaps } = await loadModule();
  const { doc, win, scripts } = fakeDom();
  const maps = { Map: function Map() {} };
  win.google = { maps };
  assert.equal(await loadGoogleMaps({ key: 'k', doc, win }), maps);
  assert.equal(scripts.length, 0);
});

test('the dark style is a style array the API will accept', async () => {
  const { DARK_STYLE } = await loadModule();
  assert.ok(Array.isArray(DARK_STYLE) && DARK_STYLE.length > 0);
  for (const rule of DARK_STYLE) {
    assert.ok(Array.isArray(rule.stylers), 'every rule styles something');
    assert.ok(rule.stylers.every((s) => typeof s === 'object'));
  }
});
