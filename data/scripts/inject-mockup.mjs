// Inject the exported snapshot (snapshot/citycrew-data.json) into the mockup's
// bundled template payload, replacing the hard-coded seed data with real places.
//
// All edits are idempotent: data blocks are delimited by markers, and code
// patches are skipped when already applied. A self-check re-parses the output
// before it is accepted. Writes citycrew-mockup-dark.html in place, plus a copy
// under the filename the pitch recorder serves.
//
// Usage: node scripts/inject-mockup.mjs

import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(DATA_DIR, '..');
const MOCKUP = join(ROOT, 'citycrew-mockup-dark.html');
const RECORDER_COPY = join(ROOT, 'cityCrew C2 Mockup Dark (standalone).html');

const snapshot = JSON.parse(readFileSync(join(DATA_DIR, 'snapshot', 'citycrew-data.json'), 'utf8'));

const html = readFileSync(MOCKUP, 'utf8');
const tplMatch = html.match(/(<script type="__bundler\/template"[^>]*>)(.*?)(<\/script>)/s);
if (!tplMatch) throw new Error('template script tag not found');
let tpl = JSON.parse(tplMatch[2]);

const applied = [];
const patch = (name, fn) => {
  const before = tpl;
  tpl = fn(tpl);
  if (tpl !== before) applied.push(name);
};

// ── 1. PLACES data ──────────────────────────────────────────────────────────
const toMockupPlace = (p) => ({
  id: p.id,
  photo: p.photo_url,           // absolute URL; res() passes it through (patch 2)
  img: 'img-cafe',              // emoji-tile fallback class if the photo fails
  emoji: p.emoji,
  en: p.en, vi: p.vi,
  loc_en: p.loc_en, loc_vi: p.loc_vi,
  rating: p.rating, price: p.price, votes: p.votes,
  desc_en: p.desc_en, desc_vi: p.desc_vi,
  attr_name: p.attr_name,
  dur_en: p.dur_en, dur_vi: p.dur_vi,
});
const placesJs = 'var PLACES = ' + JSON.stringify({
  foryou: snapshot.places.foryou.map(toMockupPlace),
  food: snapshot.places.food.map(toMockupPlace),
  out: snapshot.places.out.map(toMockupPlace),
}, null, 1) + ';';

patch('places-data', (t) => {
  const S = '/*__DATA_START__*/', E = '/*__DATA_END__*/';
  if (t.includes(S)) {
    return t.slice(0, t.indexOf(S)) + S + placesJs + E + t.slice(t.indexOf(E) + E.length);
  }
  const i = t.indexOf('var PLACES = {');
  if (i < 0) throw new Error('var PLACES not found');
  const j = t.indexOf('\n};', i);
  if (j < 0) throw new Error('end of PLACES not found');
  return t.slice(0, i) + S + placesJs + E + t.slice(j + 3);
});

// ── 2. res() passes through absolute URLs ───────────────────────────────────
patch('res-absolute-urls', (t) => {
  const orig = "function res(name){ return (window.__resources && window.__resources[name]) || 'assets/images/' + name; }";
  const repl = "function res(name){ if (/^https?:/.test(name)) return name; return (window.__resources && window.__resources[name]) || 'assets/images/' + name; }";
  return t.includes(repl) ? t : t.replace(orig, repl);
});

// ── 3. Photo attribution chip on explore cards (Places API TOS) ─────────────
patch('card-attribution', (t) => {
  const anchor = "'<div class=\"scrim\"></div>' +";
  const insert = anchor + "\n      (pl.photo && pl.attr_name ? '<div style=\"position:absolute;left:10px;top:38px;z-index:3;font-size:8.5px;color:#fff;opacity:.72;text-shadow:0 1px 2px rgba(0,0,0,.7);\">📷 ' + pl.attr_name + '</div>' : '') +";
  if (t.includes('pl.attr_name ?')) return t;
  if (!t.includes(anchor)) throw new Error('renderCards scrim anchor not found');
  return t.replace(anchor, insert);
});

// ── 4. Per-place duration + photo attribution on detail screen ──────────────
patch('detail-duration-spans', (t) => {
  const orig = '<span class="rsvp"><i data-lucide="clock"></i> <span data-lang-en="">1–2h</span><span data-lang-vi="">1–2 giờ</span></span>';
  const repl = '<span class="rsvp"><i data-lucide="clock"></i> <span data-lang-en="" id="det-dur-en">1–2h</span><span data-lang-vi="" id="det-dur-vi">1–2 giờ</span></span>';
  return t.includes('det-dur-en') ? t : t.replace(orig, repl);
});

patch('detail-open-patch', (t) => {
  const anchor = "document.getElementById('det-desc').innerHTML = LANG === 'vi' ? pl.desc_vi : pl.desc_en;";
  const insert = anchor + `
  var _de = document.getElementById('det-dur-en'), _dv = document.getElementById('det-dur-vi');
  if (_de) _de.textContent = pl.dur_en || '1–2h';
  if (_dv) _dv.textContent = pl.dur_vi || '1–2 giờ';
  var _ph = document.getElementById('det-photo');
  var _attr = document.getElementById('det-attr');
  if (!_attr && _ph && _ph.parentElement) {
    _attr = document.createElement('div');
    _attr.id = 'det-attr';
    _attr.style.cssText = 'position:absolute;right:10px;bottom:10px;z-index:2;font-size:9px;color:#fff;opacity:.85;text-shadow:0 1px 2px rgba(0,0,0,.7);';
    _ph.parentElement.style.position = 'relative';
    _ph.parentElement.appendChild(_attr);
  }
  if (_attr) _attr.textContent = (pl.photo && pl.attr_name) ? ('📷 ' + pl.attr_name) : '';`;
  if (t.includes("det-dur-en'), _dv")) return t;
  if (!t.includes(anchor)) throw new Error('openDetail anchor not found');
  return t.replace(anchor, insert);
});

// ── 5. Public collections cards from real data ──────────────────────────────
const TAB_FOR_COLLECTION = {
  'rooftops-with-a-view': 'food',
  'street-food-classics': 'food',
  'cafes-of-saigon': 'food',
  'old-saigon-heritage': 'out',
  'green-escapes': 'out',
  'first-timer-classics': 'foryou',
};
const collectionsHtml = snapshot.collections.map((c) => `              <div class="gcard crow" onclick="openCollection('${TAB_FOR_COLLECTION[c.slug] ?? 'foryou'}')">
                <img src="${c.cover_url}" alt="">
                <div style="flex:1;"><div class="ct"><span data-lang-en="">${c.title_en}</span><span data-lang-vi="">${c.title_vi}</span></div>
                  <div class="cm">${c.count} <span data-lang-en="">places · by</span><span data-lang-vi="">địa điểm · bởi</span> ${c.curator}</div></div>
                <button class="gbtn" aria-label="Open"><i data-lucide="chevron-right"></i></button>
              </div>`).join('\n');

patch('public-collections', (t) => {
  const S = '<!--__COLS_START__-->', E = '<!--__COLS_END__-->';
  if (t.includes(S)) {
    return t.slice(0, t.indexOf(S)) + S + '\n' + collectionsHtml + '\n' + E + t.slice(t.indexOf(E) + E.length);
  }
  const head = t.indexOf('<span data-lang-en="">Public collections</span>');
  if (head < 0) throw new Error('Public collections heading not found');
  const start = t.indexOf('<div class="gcard crow"', head);
  const sectionEnd = t.indexOf('</section>', head);
  if (start < 0 || sectionEnd < 0 || start > sectionEnd) throw new Error('collections block bounds not found');
  const end = t.lastIndexOf('</div>', sectionEnd) + '</div>'.length;
  return t.slice(0, start) + S + '\n' + collectionsHtml + '\n' + E + '\n            ' + t.slice(end);
});

// ── serialize + self-check ──────────────────────────────────────────────────
// JSON.stringify leaves "</script>" unescaped, which would terminate the real
// script tag early; re-escape the solidus like the original bundler payload.
const serialized = JSON.stringify(tpl).replace(/<\/script/g, '<\\/script');
const out = html.slice(0, tplMatch.index) + tplMatch[1] + serialized + tplMatch[3]
  + html.slice(tplMatch.index + tplMatch[0].length);

const check = out.match(/(<script type="__bundler\/template"[^>]*>)(.*?)(<\/script>)/s);
const checkTpl = JSON.parse(check[2]);
const ds = checkTpl.indexOf('/*__DATA_START__*/') + '/*__DATA_START__*/'.length;
const de = checkTpl.indexOf('/*__DATA_END__*/');
const placesSrc = checkTpl.slice(ds, de).replace(/^var PLACES = /, '').replace(/;$/, '');
const parsed = JSON.parse(placesSrc);
const total = parsed.foryou.length + parsed.food.length + parsed.out.length;
if (!total) throw new Error('self-check: no places after injection');
for (const key of ['foryou', 'food', 'out']) {
  for (const p of parsed[key]) {
    if (!p.en || !p.vi || !p.desc_vi) throw new Error(`self-check: ${key}/${p.id} missing bilingual fields`);
  }
}

writeFileSync(MOCKUP, out);
copyFileSync(MOCKUP, RECORDER_COPY);
console.log(`OK: patches applied [${applied.join(', ') || 'none (already up to date)'}]`);
console.log(`Places injected: foryou=${parsed.foryou.length} food=${parsed.food.length} out=${parsed.out.length}; collections=${snapshot.collections.length}`);
console.log(`Wrote ${MOCKUP}\n  and ${RECORDER_COPY}`);
