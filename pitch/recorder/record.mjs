// Records phone-isolated demo clips of the CityCrew mockup for the pitch video,
// simulating a real user session: a visible finger dot moves between controls,
// taps ripple, buttons press, tile rows swipe.
// Usage: node record.mjs  (expects the mockup served at http://127.0.0.1:8742)
import { chromium } from 'playwright';
import { mkdirSync, renameSync, readdirSync } from 'fs';
import { join } from 'path';

const URL = 'http://127.0.0.1:8742/citycrew-mockup-dark.html';
const CLIPS = join(import.meta.dirname, '..', 'clips');
// Page laid out at CSS zoom 2 → phone fills the full 864×1744 recording.
const VIEW = { width: 864, height: 1744 };

// Hide page chrome so only the phone is captured, on the app's dark background.
const ISOLATE_CSS = `
  body { background: #0B0910 !important; zoom: 2; }
  .wrap { padding: 0 !important; max-width: none !important; margin: 0 !important; }
  .stage { margin: 0 !important; padding: 21px 20px !important; background: #0B0910 !important; border-radius: 0 !important; }
  .stage-note { display: none !important; }
  .phone { box-shadow: none !important; }
  .statusbar::before { content: ""; position: absolute; left: 0; right: 0; top: -16px; bottom: -12px; z-index: -1;
    background: linear-gradient(180deg, rgba(11,9,16,.92) 55%, rgba(11,9,16,0)); }
`;

// Structure-agnostic isolation: hide every sibling on the path .stage → body,
// so only the phone stage remains no matter how the page chrome is organized.
const isolateStage = (page) => page.evaluate(() => {
  let el = document.querySelector('.stage');
  while (el && el !== document.body) {
    for (const sib of el.parentElement.children) {
      if (sib !== el) sib.style.display = 'none';
    }
    el = el.parentElement;
  }
});

// ── simulated touch: glowing finger dot + tap ripple + press + swipe ──
// Coordinates: body carries zoom:2, so getBoundingClientRect() returns visual
// pixels — divide by Z to get CSS-pixel positions for absolutely placed nodes.
const TOUCH_JS = `
window.__touch = (() => {
  const Z = 2;
  const ease = (t) => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;
  const dot = document.createElement('div');
  Object.assign(dot.style, {
    position: 'absolute', width: '46px', height: '46px', borderRadius: '50%',
    background: 'rgba(255,255,255,0.30)', border: '2px solid rgba(255,255,255,0.65)',
    boxShadow: '0 0 24px rgba(255,255,255,0.45), 0 0 60px rgba(236,108,201,0.5)',
    transform: 'translate(-50%,-50%) scale(1)', pointerEvents: 'none',
    zIndex: 999999, opacity: '0', left: '0px', top: '0px',
  });
  document.body.appendChild(dot);
  let px = 0, py = 0;

  const raf = () => new Promise((r) => requestAnimationFrame(r));
  async function animate(ms, step) {
    const t0 = performance.now();
    for (;;) {
      const p = Math.min(1, (performance.now() - t0) / ms);
      step(ease(p), p);
      if (p >= 1) return;
      await raf();
    }
  }
  const place = (x, y) => { px = x; py = y; dot.style.left = x + 'px'; dot.style.top = y + 'px'; };
  const center = (el) => {
    const r = el.getBoundingClientRect();
    return { x: (r.left + r.width / 2) / Z + window.scrollX, y: (r.top + r.height / 2) / Z + window.scrollY };
  };

  async function moveTo(el, ms = 550) {
    const { x, y } = center(el);
    dot.style.opacity = '1';
    const x0 = px || x - 120, y0 = py || y + 180;
    await animate(ms, (e) => place(x0 + (x - x0) * e, y0 + (y - y0) * e));
  }

  function ripple(x, y) {
    const r = document.createElement('div');
    Object.assign(r.style, {
      position: 'absolute', left: x + 'px', top: y + 'px', width: '20px', height: '20px',
      borderRadius: '50%', border: '3px solid rgba(255,255,255,0.85)',
      background: 'radial-gradient(circle, rgba(236,108,201,0.35), transparent 70%)',
      transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 999998,
    });
    document.body.appendChild(r);
    r.animate(
      [{ width: '20px', height: '20px', opacity: 1 }, { width: '170px', height: '170px', opacity: 0 }],
      { duration: 650, easing: 'cubic-bezier(0.2,0.6,0.3,1)' }
    ).onfinish = () => r.remove();
  }

  async function tap(el, opts = {}) {
    await moveTo(el, opts.moveMs ?? 550);
    const { x, y } = center(el);
    dot.animate(
      [{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: 'translate(-50%,-50%) scale(0.7)' },
       { transform: 'translate(-50%,-50%) scale(1)' }],
      { duration: 260, easing: 'ease-out' }
    );
    ripple(x, y);
    el.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(0.94)' }, { transform: 'scale(1)' }],
      { duration: 300, easing: 'cubic-bezier(0.3,0.7,0.4,1.2)' }
    );
    await new Promise((r) => setTimeout(r, 120));
    el.click();
  }

  async function swipe(el, dx, ms = 900) {
    await moveTo(el, 450);
    const from = el.scrollLeft;
    const fx = px;
    dot.animate([{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: 'translate(-50%,-50%) scale(0.8)' }],
      { duration: 150, fill: 'forwards' });
    await animate(ms, (e) => {
      el.scrollLeft = from + dx * e;
      dot.style.left = (fx - dx * 0.4 * e / 2) + 'px'; // finger drags opposite the scroll
    });
    dot.animate([{ transform: 'translate(-50%,-50%) scale(0.8)' }, { transform: 'translate(-50%,-50%) scale(1)' }],
      { duration: 150, fill: 'forwards' });
  }

  const hide = () => { dot.style.opacity = '0'; };
  return { tap, swipe, moveTo, hide };
})();
`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function makePage(browser, name) {
  const ctx = await browser.newContext({
    viewport: VIEW,
    recordVideo: { dir: join(CLIPS, 'raw'), size: { width: VIEW.width, height: VIEW.height } },
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: ISOLATE_CSS });
  await isolateStage(page);
  await page.evaluate(TOUCH_JS);
  // Let fonts/icons settle before the clip's "action" begins.
  await wait(1200);
  return { ctx, page, name };
}

async function finish({ ctx, page, name }) {
  await page.evaluate(() => window.__touch.hide());
  await wait(900); // tail padding
  const video = page.video();
  await ctx.close();
  const path = await video.path();
  renameSync(path, join(CLIPS, `${name}.webm`));
  console.log('saved', `${name}.webm`);
}

// Smoothly scroll the active screen element.
async function scrollScreen(page, sel, to, ms = 1600) {
  await page.evaluate(([sel, to, ms]) => new Promise((done) => {
    const el = document.querySelector(sel);
    const from = el.scrollTop, start = performance.now();
    const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / ms);
      el.scrollTop = from + (to - from) * ease(p);
      p < 1 ? requestAnimationFrame(tick) : done();
    };
    requestAnimationFrame(tick);
  }), [sel, to, ms]);
}

const tap = (page, sel) => page.evaluate((s) => window.__touch.tap(document.querySelector(s)), sel);
const swipeRow = (page, sel, dx, ms) =>
  page.evaluate(([s, dx, ms]) => {
    const el = document.querySelector(s);
    return el ? window.__touch.swipe(el, dx, ms) : null;
  }, [sel, dx, ms]);

const browser = await chromium.launch();
mkdirSync(join(CLIPS, 'raw'), { recursive: true });

// ── clip A: guest home → tap "Start exploring" → swipe the explore tile row ──
{
  const c = await makePage(browser, 'clip-a-home-swipe');
  await c.page.evaluate(() => setMode('guest'));
  await wait(1400);
  await tap(c.page, `#s-plans button[onclick="go('s-explore')"]`);
  await wait(1300);
  await swipeRow(c.page, '#s-explore .cardrow', 430, 950);
  await wait(450);
  await swipeRow(c.page, '#s-explore .cardrow', -430, 800);
  await wait(600);
  await finish(c);
}

// ── clip B: explore — save a place (ripple), open detail, add to plan ──
{
  const c = await makePage(browser, 'clip-b-explore-save');
  await c.page.evaluate(() => go('s-explore'));
  await wait(1300);
  const row = await c.page.evaluate(() => !!document.querySelector('#s-explore .cardrow'));
  if (row) { await swipeRow(c.page, '#s-explore .cardrow', 380, 900); await wait(400); }
  await tap(c.page, '#cards .pcard:nth-of-type(2) .vote');
  await wait(900);
  await tap(c.page, '#cards .pcard:nth-of-type(2)');
  await wait(1300);
  await tap(c.page, '#s-detail .cta.auth-only');
  await wait(1500);
  await finish(c);
}

// ── clip C: wizard — tap through the steps (anticipation, ends pre-generate) ──
{
  const c = await makePage(browser, 'clip-c-wizard-steps');
  await tap(c.page, '.tab[data-s="s-wizard"]');
  await wait(1100);
  await tap(c.page, '#whochips .chip:nth-child(1)');
  await wait(350);
  await tap(c.page, '#whochips .chip:nth-child(3)');
  await wait(450);
  await tap(c.page, '#wiznext');
  await wait(1000);
  await tap(c.page, '.wizstep[data-step="1"] .chip:nth-child(1)');
  await wait(350);
  await tap(c.page, '.wizstep[data-step="1"] .chip:nth-child(4)');
  await wait(450);
  await tap(c.page, '#wiznext');
  await wait(1600);
  await finish(c);
}

// ── clip D: THE WOW — finger hovers on Generate, taps, plan reveals ──
// Keep the pre-tap hover long and steady so the composition can place the
// reveal exactly on the music drop.
{
  const c = await makePage(browser, 'clip-d-wow-generate');
  await c.page.evaluate(() => { go('s-wizard'); wstep = 2; wizShow(); });
  await wait(1100);
  await c.page.evaluate(() => window.__touch.moveTo(document.querySelector('#wiznext'), 700));
  await wait(1100); // hover, held tension
  await tap(c.page, '#wiznext'); // ✨ Generate plan → itinerary + toast
  await wait(2600);
  await scrollScreen(c.page, '#s-itinerary', 260, 1500);
  await wait(600);
  await finish(c);
}

// ── clip E: itinerary — share read-only link, hop to collections ──
{
  const c = await makePage(browser, 'clip-e-share');
  await c.page.evaluate(() => go('s-itinerary'));
  await wait(1200);
  await scrollScreen(c.page, '#s-itinerary', 300, 1400);
  await wait(400);
  await tap(c.page, '#s-itinerary .rsvp[onclick]');
  await wait(1500);
  await tap(c.page, '.tab[data-s="s-collections"]');
  await wait(1200);
  await scrollScreen(c.page, '#s-collections', 260, 1300);
  await wait(700);
  await finish(c);
}

await browser.close();
// Clean the raw dir if empty
try { readdirSync(join(CLIPS, 'raw')).length === 0 && (await import('fs')).rmdirSync(join(CLIPS, 'raw')); } catch {}
console.log('all clips recorded');
