/* ── Real-data itinerary generator ──
   Source of truth: data/scripts/itinerary-runtime.js — injected verbatim into
   the mockup by inject-mockup.mjs between __ITI__ markers. Runs entirely in
   the mockup: reads wizard inputs from the DOM, picks from the injected
   PLACES (published places only), renders the s-itinerary screen. Written in
   the mockup's ES5 style. Deterministic: same inputs + same data → same plan
   (the pitch recorder depends on this). */

function itiFmtVnd(v) {
  if (!v) return '0₫';
  if (v >= 1000000) {
    var m = Math.round(v / 100000) / 10;
    return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + 'M₫';
  }
  return Math.round(v / 1000) + 'k₫';
}

function itiTime(mins) {
  var h = Math.floor(mins / 60) % 24, m = mins % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

function readWizardInputs() {
  var vibes = [];
  document.querySelectorAll('.wizstep[data-step="1"] .chip.sel[data-vibe]').forEach(function (c) {
    vibes.push(c.getAttribute('data-vibe'));
  });
  var day = 'sat';
  document.querySelectorAll('.wizstep[data-step="2"] .chipwrap .chip').forEach(function (c, i) {
    if (c.classList.contains('sel')) day = ['today', 'sat', 'sun'][i] || 'sat';
  });
  var dur = document.getElementById('durrange');
  var bud = document.getElementById('budrange');
  return {
    vibes: vibes.length ? vibes : ['cafes', 'food_tour', 'views'],
    hours: dur ? +dur.value : 12,
    budget: (bud ? +bud.value : 750) * 1000,
    people: typeof gsize === 'number' ? gsize : 5,
    day: day
  };
}

/* Slot templates: what kind of place fits each part of the day.
   food:true slots are meals and only accept category 'food'. */
var ITI_SLOTS = [
  { part: 'morning',   pref: ['cafes'],                        food: false },
  { part: 'morning',   pref: ['outdoors', 'culture'],          food: false },
  { part: 'afternoon', pref: ['food_tour'],                    food: true  },
  { part: 'afternoon', pref: ['culture', 'shopping', 'views'], food: false },
  { part: 'evening',   pref: ['food_tour'],                    food: true  },
  { part: 'evening',   pref: ['views', 'nightlife', 'chill'],  food: false }
];
var ITI_SETS = { 2: [0, 2], 3: [0, 2, 5], 4: [0, 2, 3, 5], 5: [0, 2, 3, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
var ITI_PARTS = {
  morning:   { emoji: '☀️', en: 'Morning',   vi: 'Buổi sáng' },
  afternoon: { emoji: '🌤️', en: 'Afternoon', vi: 'Buổi chiều' },
  evening:   { emoji: '🌙', en: 'Evening',   vi: 'Buổi tối' }
};
var ITI_TITLES = {
  today: { en: 'Today in Saigon',    vi: 'Hôm nay ở Sài Gòn' },
  sat:   { en: 'Saturday in Saigon', vi: 'Thứ Bảy ở Sài Gòn' },
  sun:   { en: 'Sunday in Saigon',   vi: 'Chủ Nhật ở Sài Gòn' }
};
var ITI_TRANSPORT_PER_HOP = 15000;

function itiPool() {
  var seen = {}, pool = [];
  [].concat(PLACES.food, PLACES.out).forEach(function (p) {
    if (!seen[p.id]) { seen[p.id] = 1; pool.push(p); }
  });
  return pool;
}

function itiOverlap(a, b) {
  var n = 0;
  (a || []).forEach(function (x) { if (b.indexOf(x) >= 0) n++; });
  return n;
}

function itiScore(p, slot, vibes) {
  return itiOverlap(p.vibes, vibes) * 3
    + itiOverlap(p.vibes, slot.pref) * 2
    + (parseFloat(p.rating) || 0)
    // popularity from real Google review counts, log-scaled
    + Math.min(3, Math.log10(1 + (p.rc || 0)));
}

function itiCandidates(pool, slot, vibes, used) {
  return pool
    .filter(function (p) { return !used[p.id] && (!slot.food || p.cat === 'food'); })
    .sort(function (a, b) {
      var d = itiScore(b, slot, vibes) - itiScore(a, slot, vibes);
      return d !== 0 ? d : (a.id < b.id ? -1 : 1);
    });
}

function generatePlan(inputs) {
  var pool = itiPool();
  if (!pool.length) return;

  var count = Math.max(2, Math.min(6, Math.round(inputs.hours / 2)));
  var slots = ITI_SETS[count].map(function (i) { return ITI_SLOTS[i]; });

  var used = {}, stops = [];
  slots.forEach(function (slot) {
    var best = itiCandidates(pool, slot, inputs.vibes, used)[0];
    if (best) { used[best.id] = 1; stops.push({ slot: slot, place: best }); }
  });

  // Budget pass: swap the most expensive stop for a cheaper same-slot
  // alternative until the plan fits (or no swap helps). Deterministic.
  var total = function () {
    return stops.reduce(function (s, st) { return s + (st.place.price_vnd || 0); }, 0)
      + ITI_TRANSPORT_PER_HOP * Math.max(0, stops.length - 1);
  };
  for (var guard = 0; guard < 10 && total() > inputs.budget; guard++) {
    var worst = null;
    stops.forEach(function (st) {
      if (!worst || (st.place.price_vnd || 0) > (worst.place.price_vnd || 0)) worst = st;
    });
    var cheaper = itiCandidates(pool, worst.slot, inputs.vibes, used)
      .filter(function (p) { return (p.price_vnd || 0) < (worst.place.price_vnd || 0); })[0];
    if (!cheaper) break;
    delete used[worst.place.id];
    used[cheaper.id] = 1;
    worst.place = cheaper;
  }

  // Times: start 10:00, advance by the place's average duration + 30' travel.
  var cur = 600;
  stops.forEach(function (st) {
    st.time = itiTime(cur);
    var avg = ((st.place.dur_min || 60) + (st.place.dur_max || 90)) / 2;
    cur += Math.round(avg / 15) * 15 + 30;
  });

  // ── render stops grouped by part of day ──
  var parts = ['morning', 'afternoon', 'evening'];
  var html = '';
  parts.forEach(function (part) {
    var items = stops.filter(function (st) { return st.slot.part === part; });
    if (!items.length) return;
    var lbl = ITI_PARTS[part];
    html += '<div class="gcard iti-block"><div class="tt">' + lbl.emoji
      + ' <span data-lang-en="">' + lbl.en + '</span><span data-lang-vi="">' + lbl.vi + '</span></div>';
    items.forEach(function (st) {
      var p = st.place;
      html += '<div class="iti-item"><span>' + st.time + '</span>'
        + '<span><b><span data-lang-en="">' + p.en + '</span><span data-lang-vi="">' + p.vi + '</span></b>'
        + ' · <span data-lang-en="">' + p.loc_en + '</span><span data-lang-vi="">' + p.loc_vi + '</span></span>'
        + '<span class="cost">' + (p.price || '0₫') + '</span></div>';
    });
    html += '</div>';
  });
  var stopsEl = document.getElementById('iti-stops');
  if (stopsEl) stopsEl.innerHTML = html;

  // ── donut: food / activities / transport ──
  var food = 0, act = 0;
  stops.forEach(function (st) {
    var v = st.place.price_vnd || 0;
    if (st.place.cat === 'food') food += v; else act += v;
  });
  var trans = ITI_TRANSPORT_PER_HOP * Math.max(0, stops.length - 1);
  var grand = food + act + trans;
  var C = 276, GAP = 5;
  var seg = function (v) { return grand ? Math.max(0, (v / grand) * C - GAP) : 0; };
  var a1 = seg(food), a2 = seg(act), a3 = seg(trans);
  var setArc = function (id, len, off) {
    var el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('stroke-dasharray', len.toFixed(1) + ' ' + C);
    el.setAttribute('stroke-dashoffset', String(-off.toFixed(1)));
  };
  setArc('arc-food', a1, 0);
  setArc('arc-act', a2, a1 + GAP);
  setArc('arc-trans', a3, a1 + a2 + 2 * GAP);
  var put = function (id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  put('iti-total', itiFmtVnd(grand));
  put('amt-food', itiFmtVnd(food));
  put('amt-act', itiFmtVnd(act));
  put('amt-trans', itiFmtVnd(trans));

  // ── header ──
  var title = ITI_TITLES[inputs.day] || ITI_TITLES.sat;
  var win = itiTime(600) + '–' + itiTime(600 + inputs.hours * 60);
  put('iti-title-en', title.en);
  put('iti-title-vi', title.vi);
  put('iti-window-en', 'HCMC · ' + win);
  put('iti-window-vi', 'TP.HCM · ' + win);
  put('iti-org-en', "You're organizing · " + inputs.people + ' people');
  put('iti-org-vi', 'Bạn tổ chức · ' + inputs.people + ' người');
}

try { generatePlan(readWizardInputs()); } catch (e) { /* keep the static fallback */ }
