// Inject the exported snapshot (snapshot/citycrew-data.json) into the mockup's
// bundled template payload, replacing the hard-coded seed data with real places.
//
// All edits are idempotent: data blocks are delimited by markers, and code
// patches are skipped when already applied. A self-check re-parses the output
// before it is accepted. Writes citycrew-mockup-dark.html in place — the pitch
// recorder serves the same file.
//
// Usage: node scripts/inject-mockup.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(DATA_DIR, '..');
const MOCKUP = join(ROOT, 'citycrew-mockup-dark.html');

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
const toMockupPlace = (p, cat) => ({
  id: p.id,
  photo: p.photo_url,           // absolute URL; res() passes it through (patch 2)
  img: 'img-cafe',              // emoji-tile fallback class if the photo fails
  emoji: p.emoji,
  en: p.en, vi: p.vi,
  loc_en: p.loc_en, loc_vi: p.loc_vi,
  rating: p.rating, rc: p.rating_count ?? null, price: p.price, votes: p.votes,
  desc_en: p.desc_en, desc_vi: p.desc_vi,
  attr_name: p.attr_name,
  dur_en: p.dur_en, dur_vi: p.dur_vi,
  // fields the runtime itinerary generator needs
  cat,
  vibes: p.vibes ?? [],
  price_vnd: p.price_vnd ?? 0,
  dur_min: p.dur_min ?? 60,
  dur_max: p.dur_max ?? 90,
  lat: p.lat, lng: p.lng,
});
// Snapshot is bucketed per city (export-snapshot.mjs); the mockup gets every
// city's buckets plus a CITY cursor the city toggle moves at runtime.
const placesByCity = Object.fromEntries(snapshot.cities.map((c) => [c.id, {
  foryou: snapshot.places[c.id].foryou.map((p) => toMockupPlace(p, 'featured')),
  food: snapshot.places[c.id].food.map((p) => toMockupPlace(p, 'food')),
  out: snapshot.places[c.id].out.map((p) => toMockupPlace(p, 'out')),
}]));
const placesJs =
  'var CITIES = ' + JSON.stringify(snapshot.cities, null, 1) + ';\n'
  + 'var PLACES_BY_CITY = ' + JSON.stringify(placesByCity, null, 1) + ';\n'
  + 'var CITY = ' + JSON.stringify(snapshot.default_city) + ';\n'
  + 'var PLACES = PLACES_BY_CITY[CITY];';

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

// ── 5. Collection cards render at runtime (they change with the city) ───────
const COLS_CONTAINER = '<div id="cols-list"></div>';

patch('public-collections', (t) => {
  const S = '<!--__COLS_START__-->', E = '<!--__COLS_END__-->';
  if (t.includes(S)) {
    return t.slice(0, t.indexOf(S)) + S + '\n              ' + COLS_CONTAINER + '\n              ' + E + t.slice(t.indexOf(E) + E.length);
  }
  const head = t.indexOf('<span data-lang-en="">Public collections</span>');
  if (head < 0) throw new Error('Public collections heading not found');
  const start = t.indexOf('<div class="gcard crow"', head);
  const sectionEnd = t.indexOf('</section>', head);
  if (start < 0 || sectionEnd < 0 || start > sectionEnd) throw new Error('collections block bounds not found');
  const end = t.lastIndexOf('</div>', sectionEnd) + '</div>'.length;
  return t.slice(0, start) + S + '\n              ' + COLS_CONTAINER + '\n              ' + E + '\n            ' + t.slice(end);
});

// The two "My collections" demo cards become a runtime container too — their
// contents are per-city. The dashed "New collection" card stays static.
patch('personal-collections-container', (t) => {
  const S = '<!--__MYCOLS_START__-->', E = '<!--__MYCOLS_END__-->';
  const block = S + '\n                <div id="mycols-list"></div>\n                ' + E;
  if (t.includes(S)) {
    return t.slice(0, t.indexOf(S)) + block + t.slice(t.indexOf(E) + E.length);
  }
  const start = t.indexOf(`<div class="gcard" style="margin:0 20px 10px;padding:13px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;" onclick="openCollection('date-night')">`);
  const end = t.indexOf('<div class="gcard" style="margin:0 20px 4px;');
  if (start < 0 || end < 0 || start > end) throw new Error('my-collections cards bounds not found');
  return t.slice(0, start) + block + '\n                ' + t.slice(end);
});

// ── 5b. Real review counts: the bookmark badge used to show a fabricated
// "saved" number; replace every fabricated count with the real Google
// rating_count (pl.rc). Bookmark becomes a pure toggle. ─────────────────────
patch('real-review-counts', (t) => {
  if (t.includes('fmtCount')) return t;
  const swaps = [
    // helper, injected just before icons()
    ['function icons() {',
      "function fmtCount(n){ return !n ? '' : (n >= 1000 ? (Math.round(n / 100) / 10) + 'k' : String(n)); }\nfunction icons() {"],
    // renderCards: drop the fabricated per-card count…
    ['    var v = (saved[pl.id] ? 1 : 0) + pl.votes;',
      '    var rc = fmtCount(pl.rc);'],
    // …show real review count beside the star rating (chip hidden when the
    // place genuinely has no Google rating — never invent one)…
    [`'<div class="top"><span class="rating"><i data-lucide="star"></i>' + pl.rating + '</span>' +`,
      `'<div class="top">' + (pl.rating ? '<span class="rating"><i data-lucide="star"></i>' + pl.rating + (rc ? ' · ' + rc : '') + '</span>' : '<span></span>') +`],
    // …and make the bookmark badge icon-only
    [`'<span class="vote' + (saved[pl.id] ? ' voted' : '') + '"><i data-lucide="bookmark"></i>' + v + '</span></div>' +`,
      `'<span class="vote' + (saved[pl.id] ? ' voted' : '') + '"><i data-lucide="bookmark"></i></span></div>' +`],
    // detail screen: real Google review count instead of fake "N saved"
    [`document.getElementById('det-votes').innerHTML = '<b>' + ((saved[pl.id] ? 1 : 0) + pl.votes) + '</b> ' + (LANG === 'vi' ? 'đã lưu' : 'saved');`,
      `document.getElementById('det-votes').innerHTML = pl.rc ? '<b>' + fmtCount(pl.rc) + '</b> ' + (LANG === 'vi' ? 'đánh giá Google' : 'Google reviews') : '';`],
    // saveDetail: keep the heart toggle, stop rewriting any number
    [`document.getElementById('det-votes').innerHTML = '<b>' + ((saved[current.id] ? 1 : 0) + current.votes) + '</b> ' + (LANG === 'vi' ? 'đã lưu' : 'saved');`,
      ''],
  ];
  for (const [from, to] of swaps) {
    if (!t.includes(from)) throw new Error(`real-review-counts anchor not found: ${from.slice(0, 60)}…`);
    t = t.replace(from, to);
  }
  return t;
});

// ── 5c. Collection detail view ──────────────────────────────────────────────
// Tapping a collection used to dump the user on the Explore tab with a rough
// category filter; now it opens a real detail screen listing the collection's
// actual places. The two "My collections" demo cards are backed by real
// published places too (6 and 9, matching their card labels).
// Personal demo collections, per city: HCMC keeps the hand-picked lists;
// other cities auto-pick deterministically by vibe + rating. A city whose
// pick resolves fewer than 3 members hides the card entirely.
const PERSONAL_DEFS = [
  {
    slug: 'date-night',
    en: 'Date night', vi: 'Hẹn hò tối',
    desc_en: 'Your private shortlist for the next evening out.',
    desc_vi: 'Danh sách riêng của bạn cho buổi hẹn tối tiếp theo.',
    flavor_en: 'private', flavor_vi: 'riêng tư',
    vibes: ['nightlife', 'views', 'chill'], size: 6,
    handPicked: {
      hcmc: ['chill-skybar', 'saigon-night-cruise', 'carmen-bar', 'lusine-le-loi', 'blank-lounge', 'saigon-opera-house'],
    },
  },
  {
    slug: 'weekend-family',
    en: 'Weekend with family', vi: 'Cuối tuần cùng gia đình',
    desc_en: 'Easy classics the whole crew can do in a weekend.',
    desc_vi: 'Những điểm kinh điển nhẹ nhàng cả nhà cùng đi trong cuối tuần.',
    flavor_en: 'shared with 3 friends', flavor_vi: 'chia sẻ với 3 người bạn',
    vibes: ['culture', 'outdoors', 'food_tour'], size: 9,
    handPicked: {
      hcmc: ['book-street', 'independence-palace', 'central-post-office', 'notre-dame-cathedral', 'nguyen-hue-walking-street', 'bitexco-skydeck', 'banh-mi-huynh-hoa', 'fine-arts-museum', 'jade-emperor-pagoda'],
    },
  },
];

// All of a city's cards, deduped (foryou overlaps food/out via is_featured).
const cityCards = (cityId) => {
  const b = snapshot.places[cityId];
  const seen = new Set();
  return [...b.foryou, ...b.food, ...b.out].filter((p) => !seen.has(p.id) && seen.add(p.id));
};

const personalFor = (cityId) => {
  const cards = cityCards(cityId);
  const byId = new Map(cards.map((p) => [p.id, p]));
  return PERSONAL_DEFS.flatMap((def) => {
    let slugs = (def.handPicked[cityId] ?? []).filter((s) => byId.has(s));
    if (!slugs.length) {
      slugs = cards
        .filter((p) => (p.vibes ?? []).some((v) => def.vibes.includes(v)))
        .sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0) || a.id.localeCompare(b.id))
        .slice(0, def.size)
        .map((p) => p.id);
    }
    if (slugs.length < 3) return [];
    return [{
      slug: def.slug, en: def.en, vi: def.vi,
      desc_en: def.desc_en, desc_vi: def.desc_vi,
      curator: null,
      cover: byId.get(slugs[0])?.photo_url ?? null,
      place_slugs: slugs,
      personal: true,
      flavor_en: def.flavor_en, flavor_vi: def.flavor_vi,
    }];
  });
};

const collectionsByCity = Object.fromEntries(snapshot.cities.map((city) => {
  const personal = personalFor(city.id).map((c) => [c.slug, c]);
  const publicCols = (snapshot.collections[city.id] ?? []).map((c) => [c.slug, {
    en: c.title_en, vi: c.title_vi,
    desc_en: c.desc_en, desc_vi: c.desc_vi,
    curator: c.curator ?? null, cover: c.cover_url ?? null,
    place_slugs: c.place_slugs,
  }]);
  return [city.id, Object.fromEntries([...personal, ...publicCols])];
}));

const collectionsJs =
  'var COLLECTIONS_BY_CITY = ' + JSON.stringify(collectionsByCity, null, 1) + ';\n'
  + 'var COLLECTIONS = COLLECTIONS_BY_CITY[CITY] || {};';

patch('collections-data', (t) => {
  const S = '/*__COLS_DATA_START__*/', E = '/*__COLS_DATA_END__*/';
  const block = S + collectionsJs + E;
  if (t.includes(S)) {
    return t.slice(0, t.indexOf(S)) + block + t.slice(t.indexOf(E) + E.length);
  }
  const anchor = '/*__DATA_END__*/';
  if (!t.includes(anchor)) throw new Error('places data end marker not found');
  return t.replace(anchor, anchor + '\n' + block);
});

const COLLECTION_SCREEN = `<!--__COLDETAIL_START__-->
            <!-- ── SCREEN: COLLECTION DETAIL ── -->
            <section class="screen" id="s-collection">
              <div class="pad" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <button class="gbtn" onclick="go('s-collections')" aria-label="Back"><i data-lucide="chevron-left"></i></button>
                <button class="gbtn" onclick="toast('cshared')" aria-label="Share collection"><i data-lucide="share-2"></i></button>
              </div>
              <div class="hero" style="height:190px;">
                <img id="col-cover" class="real" alt="">
                <div class="scrim"></div>
              </div>
              <div class="pad" style="margin-top:14px;">
                <h2 class="h-display" style="font-size:24px;"><span data-lang-en="" id="col-title-en"></span><span data-lang-vi="" id="col-title-vi"></span></h2>
                <div class="sub" style="font-size:13px;margin-top:4px;"><span id="col-count"></span> <span data-lang-en="">places</span><span data-lang-vi="">địa điểm</span><span id="col-by"> · <span data-lang-en="">by</span><span data-lang-vi="">bởi</span> <span id="col-curator"></span></span></div>
                <p class="sub" style="font-size:14px;line-height:1.55;margin-top:10px;max-width:none;"><span data-lang-en="" id="col-desc-en"></span><span data-lang-vi="" id="col-desc-vi"></span></p>
              </div>
              <div id="col-places" style="margin-top:12px;"></div>
            </section>
            <!--__COLDETAIL_END__-->`;

patch('collection-screen', (t) => {
  const S = '<!--__COLDETAIL_START__-->', E = '<!--__COLDETAIL_END__-->';
  if (t.includes(S)) {
    return t.slice(0, t.indexOf(S)) + COLLECTION_SCREEN + t.slice(t.indexOf(E) + E.length);
  }
  const anchor = '<!-- ── SCREEN: PROFILE ── -->';
  if (!t.includes(anchor)) throw new Error('profile screen anchor not found');
  return t.replace(anchor, COLLECTION_SCREEN + '\n\n            ' + anchor);
});

const OPEN_COLLECTION_FN = `var DET_BACK = 's-explore';
function openCollection(slug) {
  var c = COLLECTIONS[slug];
  if (!c) { go('s-collections'); return; }
  var byId = {};
  [].concat(PLACES.foryou, PLACES.food, PLACES.out).forEach(function (p) { byId[p.id] = p; });
  var members = c.place_slugs.map(function (s) { return byId[s]; }).filter(Boolean);
  document.getElementById('col-title-en').textContent = c.en;
  document.getElementById('col-title-vi').textContent = c.vi;
  document.getElementById('col-desc-en').textContent = c.desc_en || '';
  document.getElementById('col-desc-vi').textContent = c.desc_vi || '';
  document.getElementById('col-count').textContent = members.length;
  document.getElementById('col-by').style.display = c.curator ? '' : 'none';
  document.getElementById('col-curator').textContent = c.curator || '';
  var cover = document.getElementById('col-cover');
  var coverUrl = c.cover || (members[0] && members[0].photo) || '';
  if (coverUrl) { cover.src = res(coverUrl); cover.style.display = 'block'; } else { cover.style.display = 'none'; }
  var wrap = document.getElementById('col-places');
  wrap.innerHTML = '';
  members.forEach(function (pl) {
    var row = document.createElement('div');
    row.className = 'gcard crow';
    row.style.cursor = 'pointer';
    var media = pl.photo
      ? '<img src="' + res(pl.photo) + '" alt="">'
      : '<div style="width:84px;height:84px;border-radius:20px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-size:30px;background:var(--surface-glass);">' + (pl.emoji || '📍') + '</div>';
    row.innerHTML = media +
      '<div style="flex:1;"><div class="ct"><span data-lang-en="">' + pl.en + '</span><span data-lang-vi="">' + pl.vi + '</span></div>' +
      '<div class="cm">' + (pl.rating ? '★ ' + pl.rating + (fmtCount(pl.rc) ? ' · ' + fmtCount(pl.rc) : '') + ' · ' : '') +
      '<span data-lang-en="">' + pl.loc_en + '</span><span data-lang-vi="">' + pl.loc_vi + '</span></div></div>' +
      '<button class="gbtn" aria-label="Open"><i data-lucide="chevron-right"></i></button>';
    row.onclick = function () { openDetail(pl); };
    wrap.appendChild(row);
  });
  go('s-collection');
  document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-s') === 's-collections'); });
  icons();
}`;

patch('open-collection-fn', (t) => {
  const orig = "function openCollection(cat) { activeCat = cat; renderFilters(); renderCards(); go('s-explore'); }";
  if (t.includes('var c = COLLECTIONS[slug]')) return t;
  if (!t.includes(orig)) throw new Error('openCollection not found');
  return t.replace(orig, OPEN_COLLECTION_FN);
});

// Place detail's back button returns to whichever screen opened it (explore
// or a collection), instead of always dumping the user on Explore.
patch('detail-back-target', (t) => {
  const orig = `<button class="gbtn" onclick="go('s-explore')" aria-label="Back"><i data-lucide="chevron-left"></i></button>`;
  const repl = `<button class="gbtn" onclick="go(DET_BACK)" aria-label="Back"><i data-lucide="chevron-left"></i></button>`;
  if (t.includes('go(DET_BACK)')) return t;
  if (!t.includes(orig)) throw new Error('detail back button not found');
  return t.replace(orig, repl);
});

patch('detail-back-capture', (t) => {
  const anchor = 'function openDetail(pl) {\n  current = pl;';
  const insert = "function openDetail(pl) {\n  var _scr = document.querySelector('.screen.active');\n  if (_scr && _scr.id !== 's-detail') DET_BACK = _scr.id;\n  current = pl;";
  if (t.includes("DET_BACK = _scr.id")) return t;
  if (!t.includes(anchor)) throw new Error('openDetail head not found');
  return t.replace(anchor, insert);
});

// ── 5d. City toggle + runtime ───────────────────────────────────────────────
const cityToggleHtml = '<!--__CITY_TOGGLE_START__--><div class="lang-toggle city-toggle" role="group" aria-label="City / Thành phố">'
  + snapshot.cities.map((c) =>
    `<button id="btn-city-${c.id}"${c.id === snapshot.default_city ? ' class="active"' : ''} onclick="setCity('${c.id}')">`
    + `<span data-lang-en="">${c.short_en}</span><span data-lang-vi="">${c.short_vi}</span></button>`).join('')
  + '</div><!--__CITY_TOGGLE_END__-->';

patch('city-toggle', (t) => {
  const S = '<!--__CITY_TOGGLE_START__-->', E = '<!--__CITY_TOGGLE_END__-->';
  if (t.includes(S)) {
    return t.slice(0, t.indexOf(S)) + cityToggleHtml + t.slice(t.indexOf(E) + E.length);
  }
  const anchor = '<div class="lang-toggle mode-toggle" role="group" aria-label="Guest / Signed in">';
  if (!t.includes(anchor)) throw new Error('toggles bar anchor not found');
  return t.replace(anchor, cityToggleHtml + '\n    ' + anchor);
});

const CITY_RUNTIME = `/*__CITY_RT_START__*/
function renderCollections() {
  var pub = document.getElementById('cols-list');
  var mine = document.getElementById('mycols-list');
  if (!pub || !mine) return;
  pub.innerHTML = ''; mine.innerHTML = '';
  Object.keys(COLLECTIONS).forEach(function (slug) {
    var c = COLLECTIONS[slug];
    if (c.personal) {
      var card = document.createElement('div');
      card.className = 'gcard';
      card.style.cssText = 'margin:0 20px 10px;padding:13px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;';
      card.onclick = function () { openCollection(slug); };
      card.innerHTML = '<img class="thumb" src="' + res(c.cover) + '" alt="">'
        + '<div style="flex:1;"><div style="font-weight:600;font-size:14px;"><span data-lang-en="">' + c.en + '</span><span data-lang-vi="">' + c.vi + '</span></div>'
        + '<div class="sub" style="font-size:12px;">' + c.place_slugs.length + ' <span data-lang-en="">places · ' + c.flavor_en + '</span><span data-lang-vi="">địa điểm · ' + c.flavor_vi + '</span></div></div>'
        + '<button class="gbtn" style="width:34px;height:34px;" aria-label="Share collection"><i data-lucide="share-2" style="width:16px;height:16px;"></i></button>';
      card.querySelector('button').onclick = function (ev) { ev.stopPropagation(); toast('cshared'); };
      mine.appendChild(card);
    } else {
      var row = document.createElement('div');
      row.className = 'gcard crow';
      row.onclick = function () { openCollection(slug); };
      row.innerHTML = '<img src="' + res(c.cover) + '" alt="">'
        + '<div style="flex:1;"><div class="ct"><span data-lang-en="">' + c.en + '</span><span data-lang-vi="">' + c.vi + '</span></div>'
        + '<div class="cm">' + c.place_slugs.length + ' <span data-lang-en="">places · by</span><span data-lang-vi="">địa điểm · bởi</span> ' + (c.curator || '@citycrew') + '</div></div>'
        + '<button class="gbtn" aria-label="Open"><i data-lucide="chevron-right"></i></button>';
      pub.appendChild(row);
    }
  });
  icons();
}
function setCity(id) {
  if (!PLACES_BY_CITY[id]) return;
  CITY = id;
  PLACES = PLACES_BY_CITY[id];
  COLLECTIONS = COLLECTIONS_BY_CITY[id] || {};
  saved = {};
  document.querySelectorAll('.city-toggle button').forEach(function (b) {
    b.classList.toggle('active', b.id === 'btn-city-' + id);
  });
  renderFilters(); renderCards(); renderCollections();
  try { generatePlan(readWizardInputs()); } catch (e) { /* wizard not booted yet */ }
  var scr = document.querySelector('.screen.active');
  if (scr && (scr.id === 's-collection' || scr.id === 's-detail')) go('s-explore');
  icons();
}
/*__CITY_RT_END__*/
`;

patch('city-runtime', (t) => {
  const S = '/*__CITY_RT_START__*/', E = '/*__CITY_RT_END__*/';
  if (t.includes(S)) {
    return t.slice(0, t.indexOf(S)) + CITY_RUNTIME + t.slice(t.indexOf(E) + E.length + 1);
  }
  const anchor = "var DET_BACK = 's-explore';";
  if (!t.includes(anchor)) throw new Error('city runtime anchor (DET_BACK) not found');
  return t.replace(anchor, CITY_RUNTIME + anchor);
});

// ── 6. Wizard: vibe slugs + slider ids so the generator can read inputs ─────
const VIBE_LABELS = [
  ['Cafés', 'cafes'], ['Food tour', 'food_tour'], ['Outdoors', 'outdoors'],
  ['Views', 'views'], ['Culture', 'culture'], ['Shopping', 'shopping'],
  ['Nightlife', 'nightlife'], ['Chill', 'chill'],
];
patch('wizard-vibe-slugs', (t) => {
  if (t.includes('data-vibe=')) return t;
  for (const [label, slug] of VIBE_LABELS) {
    const anchor = `onclick="this.classList.toggle('sel')"><span data-lang-en="">${label}</span>`;
    if (!t.includes(anchor)) throw new Error(`vibe chip not found: ${label}`);
    t = t.replace(anchor, `data-vibe="${slug}" ${anchor}`);
  }
  return t;
});

patch('wizard-slider-ids', (t) => {
  if (t.includes('id="durrange"')) return t;
  const dur = '<input type="range" min="2" max="14" value="12"';
  const bud = '<input type="range" min="100" max="2000" step="50" value="750"';
  if (!t.includes(dur) || !t.includes(bud)) throw new Error('wizard sliders not found');
  return t
    .replace(dur, '<input type="range" id="durrange" min="2" max="14" value="12"')
    .replace(bud, '<input type="range" id="budrange" min="100" max="2000" step="50" value="750"');
});

// ── 7. Itinerary screen: ids + stops wrapper + rebuilt donut ────────────────
// All replacements are scoped to the s-itinerary section (the same title text
// also exists on the s-plans hero card, which stays static by design).
const inItinerary = (t, fn) => {
  const s = t.indexOf('<section class="screen" id="s-itinerary">');
  const e = t.indexOf('</section>', s);
  if (s < 0 || e < 0) throw new Error('s-itinerary section not found');
  return t.slice(0, s) + fn(t.slice(s, e)) + t.slice(e);
};

patch('itinerary-header-ids', (t) => {
  if (t.includes('id="iti-title-en"')) return t;
  return inItinerary(t, (sec) => {
    const swaps = [
      ['<span data-lang-en="">Saturday in District 1</span><span data-lang-vi="">Thứ Bảy ở Quận 1</span>',
        '<span data-lang-en="" id="iti-title-en">Saturday in District 1</span><span data-lang-vi="" id="iti-title-vi">Thứ Bảy ở Quận 1</span>'],
      ['<span data-lang-en="">HCMC · Sat Aug 8 · 10:00–22:00</span><span data-lang-vi="">TP.HCM · T7 8/8 · 10:00–22:00</span>',
        '<span data-lang-en="" id="iti-window-en">HCMC · 10:00–22:00</span><span data-lang-vi="" id="iti-window-vi">TP.HCM · 10:00–22:00</span>'],
      ["<span data-lang-en=\"\">You're organizing · 5 people</span><span data-lang-vi=\"\">Bạn tổ chức · 5 người</span>",
        "<span data-lang-en=\"\" id=\"iti-org-en\">You're organizing · 5 people</span><span data-lang-vi=\"\" id=\"iti-org-vi\">Bạn tổ chức · 5 người</span>"],
    ];
    for (const [from, to] of swaps) {
      if (!sec.includes(from)) throw new Error(`itinerary header anchor not found: ${from.slice(0, 50)}…`);
      sec = sec.replace(from, to);
    }
    return sec;
  });
});

patch('itinerary-stops-wrap', (t) => {
  if (t.includes('id="iti-stops"')) return t;
  return inItinerary(t, (sec) => {
    const b1 = sec.indexOf('<div class="gcard iti-block">');
    const donut = sec.indexOf('<div class="gcard donut-wrap">');
    if (b1 < 0 || donut < 0 || b1 > donut) throw new Error('itinerary stops bounds not found');
    return sec.slice(0, b1) + '<div id="iti-stops">' + sec.slice(b1, donut) + '</div>\n              ' + sec.slice(donut);
  });
});

const DONUT_HTML = `<div class="gcard donut-wrap">
                <svg width="110" height="110" viewBox="0 0 110 110">
                  <circle cx="55" cy="55" r="44" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="14"></circle>
                  <circle id="arc-food" cx="55" cy="55" r="44" fill="none" stroke="#EC6CC9" stroke-width="14" stroke-dasharray="129 276" stroke-dashoffset="0" transform="rotate(-90 55 55)" stroke-linecap="round"></circle>
                  <circle id="arc-act" cx="55" cy="55" r="44" fill="none" stroke="#8B5CF6" stroke-width="14" stroke-dasharray="110 276" stroke-dashoffset="-134" transform="rotate(-90 55 55)" stroke-linecap="round"></circle>
                  <circle id="arc-trans" cx="55" cy="55" r="44" fill="none" stroke="#F6A45C" stroke-width="14" stroke-dasharray="27 276" stroke-dashoffset="-249" transform="rotate(-90 55 55)" stroke-linecap="round"></circle>
                  <text x="55" y="51" text-anchor="middle" fill="#fff" font-size="15" font-weight="700" id="iti-total">750k₫</text>
                  <text x="55" y="67" text-anchor="middle" fill="rgba(255,255,255,.55)" font-size="9">/ <tspan id="pp">person</tspan></text>
                </svg>
                <div class="legend" style="flex:1;">
                  <div class="row"><span class="dot" style="background:var(--ai-pink);"></span><span data-lang-en="">Food &amp; drinks</span><span data-lang-vi="">Ăn uống</span><span class="amt" id="amt-food">350k₫</span></div>
                  <div class="row"><span class="dot" style="background:var(--ai-violet);"></span><span data-lang-en="">Activities</span><span data-lang-vi="">Hoạt động</span><span class="amt" id="amt-act">300k₫</span></div>
                  <div class="row"><span class="dot" style="background:var(--ai-amber);"></span><span data-lang-en="">Transport</span><span data-lang-vi="">Di chuyển</span><span class="amt" id="amt-trans">100k₫</span></div>
                </div>
              </div>`;

patch('itinerary-donut-ids', (t) => {
  if (t.includes('id="arc-food"')) return t;
  return inItinerary(t, (sec) => {
    const d = sec.indexOf('<div class="gcard donut-wrap">');
    const end = sec.indexOf('<div style="height:10px;"></div>', d);
    if (d < 0 || end < 0) throw new Error('donut bounds not found');
    return sec.slice(0, d) + DONUT_HTML + '\n              ' + sec.slice(end);
  });
});

// ── 8. Generator runtime + wizard hook ──────────────────────────────────────
const RUNTIME = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'itinerary-runtime.js'), 'utf8');

patch('itinerary-runtime', (t) => {
  const S = '/*__ITI_START__*/', E = '/*__ITI_END__*/';
  const block = `${S}\n${RUNTIME}\n${E}\n`;
  if (t.includes(S)) {
    return t.slice(0, t.indexOf(S)) + block + t.slice(t.indexOf(E) + E.length + 1);
  }
  const boot = 'renderFilters(); renderCards(); wizShow(); icons();';
  if (!t.includes(boot)) throw new Error('boot line not found');
  return t.replace(boot, block + boot);
});

patch('wizard-generate-hook', (t) => {
  const orig = "else { go('s-itinerary'); toast('generated'); wstep = 0; wizShow(); }";
  const repl = "else { try { generatePlan(readWizardInputs()); } catch (e) {} go('s-itinerary'); toast('generated'); wstep = 0; wizShow(); }";
  if (t.includes('catch (e) {} go(')) return t;
  if (!t.includes(orig)) throw new Error('wizNext generate branch not found');
  return t.replace(orig, repl);
});

// Runs after the itinerary-runtime patch on purpose: that patch's fresh-
// template fallback anchors on the original boot line this one rewrites.
patch('boot-render-collections', (t) => {
  if (t.includes('renderCollections(); wizShow();')) return t;
  const boot = 'renderFilters(); renderCards(); wizShow(); icons();';
  if (!t.includes(boot)) throw new Error('boot line not found');
  return t.replace(boot, 'renderFilters(); renderCards(); renderCollections(); wizShow(); icons();');
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
const dataBlock = checkTpl.slice(ds, de);
const parse = (label, re) => {
  const m = dataBlock.match(re);
  if (!m) throw new Error(`self-check: ${label} not found in data block`);
  return JSON.parse(m[1]);
};
const checkCities = parse('CITIES', /var CITIES = ([\s\S]*?);\nvar PLACES_BY_CITY/);
const checkPlaces = parse('PLACES_BY_CITY', /var PLACES_BY_CITY = ([\s\S]*?);\nvar CITY = /);
if (!checkCities.length) throw new Error('self-check: no cities after injection');

const cs = checkTpl.indexOf('/*__COLS_DATA_START__*/') + '/*__COLS_DATA_START__*/'.length;
const ce = checkTpl.indexOf('/*__COLS_DATA_END__*/');
if (ce < 0) throw new Error('self-check: COLLECTIONS block missing');
const colsMatch = checkTpl.slice(cs, ce).match(/var COLLECTIONS_BY_CITY = ([\s\S]*?);\nvar COLLECTIONS = /);
if (!colsMatch) throw new Error('self-check: COLLECTIONS_BY_CITY not found');
const checkCols = JSON.parse(colsMatch[1]);

for (const city of checkCities) {
  const buckets = checkPlaces[city.id];
  if (!buckets) throw new Error(`self-check: city ${city.id} has no place buckets`);
  const cards = [...buckets.foryou, ...buckets.food, ...buckets.out];
  if (!cards.length) throw new Error(`self-check: city ${city.id} has zero places`);
  for (const p of cards) {
    if (!p.en || !p.vi || !p.desc_vi) throw new Error(`self-check: ${city.id}/${p.id} missing bilingual fields`);
  }
  const idSet = new Set(cards.map((p) => p.id));
  for (const [slug, c] of Object.entries(checkCols[city.id] ?? {})) {
    if (!c.place_slugs.some((s) => idSet.has(s))) {
      throw new Error(`self-check: ${city.id}/${slug} resolves to no published places in its own city`);
    }
    if (!c.en || !c.vi) throw new Error(`self-check: collection ${slug} missing bilingual titles`);
  }
  if (!checkTpl.includes(`btn-city-${city.id}`)) throw new Error(`self-check: city toggle missing button for ${city.id}`);
}
if (!checkTpl.includes('id="s-collection"')) throw new Error('self-check: collection detail screen missing');
if (!checkTpl.includes('function setCity(')) throw new Error('self-check: setCity runtime missing');
if (!checkTpl.includes('id="cols-list"') || !checkTpl.includes('id="mycols-list"')) {
  throw new Error('self-check: collection list containers missing');
}
if (checkTpl.includes("openCollection('food')") || checkTpl.includes("openCollection('out')")) {
  throw new Error('self-check: stale category-based openCollection call remains');
}

writeFileSync(MOCKUP, out);
console.log(`OK: patches applied [${applied.join(', ') || 'none (already up to date)'}]`);
const perCity = checkCities
  .map((c) => {
    const b = checkPlaces[c.id];
    return `${c.id}: foryou=${b.foryou.length} food=${b.food.length} out=${b.out.length} cols=${Object.keys(checkCols[c.id] ?? {}).length}`;
  })
  .join(' | ');
console.log(`Places injected per city — ${perCity}`);
console.log(`Wrote ${MOCKUP}`);
