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
const placesJs = 'var PLACES = ' + JSON.stringify({
  foryou: snapshot.places.foryou.map((p) => toMockupPlace(p, 'featured')),
  food: snapshot.places.food.map((p) => toMockupPlace(p, 'food')),
  out: snapshot.places.out.map((p) => toMockupPlace(p, 'out')),
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
const collectionsHtml = snapshot.collections.map((c) => `              <div class="gcard crow" onclick="openCollection('${c.slug}')">
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
const PERSONAL_COLLECTIONS = [
  {
    slug: 'date-night',
    title_en: 'Date night', title_vi: 'Hẹn hò tối',
    desc_en: 'Your private shortlist for the next evening out.',
    desc_vi: 'Danh sách riêng của bạn cho buổi hẹn tối tiếp theo.',
    curator: null, cover_url: null,
    place_slugs: ['chill-skybar', 'saigon-night-cruise', 'carmen-bar', 'lusine-le-loi', 'blank-lounge', 'saigon-opera-house'],
  },
  {
    slug: 'weekend-family',
    title_en: 'Weekend with family', title_vi: 'Cuối tuần cùng gia đình',
    desc_en: 'Easy classics the whole crew can do in a weekend.',
    desc_vi: 'Những điểm kinh điển nhẹ nhàng cả nhà cùng đi trong cuối tuần.',
    curator: null, cover_url: null,
    place_slugs: ['book-street', 'independence-palace', 'central-post-office', 'notre-dame-cathedral', 'nguyen-hue-walking-street', 'bitexco-skydeck', 'banh-mi-huynh-hoa', 'fine-arts-museum', 'jade-emperor-pagoda'],
  },
];

const publishedIds = new Set(Object.values(snapshot.places).flat().map((p) => p.id));
const collectionsJs = 'var COLLECTIONS = ' + JSON.stringify(Object.fromEntries(
  [...snapshot.collections, ...PERSONAL_COLLECTIONS].map((c) => {
    const slugs = c.place_slugs.filter((s) => publishedIds.has(s));
    if (!slugs.length) throw new Error(`collection ${c.slug} has no published places`);
    return [c.slug, {
      en: c.title_en, vi: c.title_vi,
      desc_en: c.desc_en, desc_vi: c.desc_vi,
      curator: c.curator ?? null, cover: c.cover_url ?? null,
      place_slugs: slugs,
    }];
  })), null, 1) + ';';

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

// "My collections" demo cards point at their real-data collections.
patch('personal-collection-links', (t) => {
  if (t.includes("openCollection('date-night')")) return t;
  const dn = `onclick="openCollection('food')"`;
  const wf = `onclick="openCollection('out')"`;
  if (!t.includes(dn) || !t.includes(wf)) throw new Error('personal collection cards not found');
  return t.replace(dn, `onclick="openCollection('date-night')"`).replace(wf, `onclick="openCollection('weekend-family')"`);
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

const cs = checkTpl.indexOf('/*__COLS_DATA_START__*/') + '/*__COLS_DATA_START__*/'.length;
const ce = checkTpl.indexOf('/*__COLS_DATA_END__*/');
if (ce < 0) throw new Error('self-check: COLLECTIONS block missing');
const cols = JSON.parse(checkTpl.slice(cs, ce).replace(/^var COLLECTIONS = /, '').replace(/;$/, ''));
const idSet = new Set([...parsed.foryou, ...parsed.food, ...parsed.out].map((p) => p.id));
for (const [slug, c] of Object.entries(cols)) {
  if (!c.place_slugs.some((s) => idSet.has(s))) throw new Error(`self-check: collection ${slug} resolves to no published places`);
  if (!c.en || !c.vi) throw new Error(`self-check: collection ${slug} missing bilingual titles`);
}
if (!checkTpl.includes('id="s-collection"')) throw new Error('self-check: collection detail screen missing');
if (checkTpl.includes("openCollection('food')") || checkTpl.includes("openCollection('out')")) {
  throw new Error('self-check: stale category-based openCollection call remains');
}

writeFileSync(MOCKUP, out);
console.log(`OK: patches applied [${applied.join(', ') || 'none (already up to date)'}]`);
console.log(`Places injected: foryou=${parsed.foryou.length} food=${parsed.food.length} out=${parsed.out.length}; collections=${Object.keys(cols).length}`);
console.log(`Wrote ${MOCKUP}`);
