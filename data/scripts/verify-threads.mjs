// Check whether the handles in data/seeds/socials.json actually resolve to a
// Threads profile, and write the verdict back into `threads_status`.
//
// A Threads account IS an Instagram account — same username — so the profile
// URL is always https://www.threads.com/@<instagram handle>. What this script
// answers is the one thing the handle alone can't: whether the venue ever
// activated Threads, since an Instagram account without one 404s.
//
// Needs a network that can reach threads.com. Some sandboxes (Claude Code on
// the web) have Meta domains blocked at the egress proxy and every check will
// come back `error` — run it from a normal machine.
//
// Usage: node scripts/verify-threads.mjs [--only slug1,slug2] [--write]

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOCIALS_PATH = join(DATA_DIR, 'seeds', 'socials.json');

const write = process.argv.includes('--write');
const onlyArg = process.argv[process.argv.indexOf('--only') + 1];
const only = process.argv.includes('--only') ? onlyArg.split(',') : null;

const socials = JSON.parse(readFileSync(SOCIALS_PATH, 'utf8'));
const targets = Object.entries(socials.places)
  .filter(([slug, p]) => p.instagram && (!only || only.includes(slug)));

if (!targets.length) {
  console.error('Nothing to check — every selected place is missing an instagram handle.');
  process.exit(1);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'en-US' });

// Threads renders the profile client-side, so wait for the network to settle
// before deciding a page is empty.
async function check(handle) {
  const page = await ctx.newPage();
  try {
    const res = await page.goto(`https://www.threads.com/@${handle}`, {
      waitUntil: 'networkidle',
      timeout: 45000,
    });
    if (res?.status() === 404) return { status: 'missing' };
    const body = await page.locator('body').innerText();
    if (/isn'?t available|Page not found/i.test(body)) return { status: 'missing' };
    // The follower line only renders on a real profile; a login wall has none.
    const followers = body.match(/([\d.,KMkm]+)\s+followers?/)?.[1] ?? null;
    return { status: followers ? 'confirmed' : 'inconclusive', followers };
  } catch (err) {
    return { status: 'error', detail: String(err.message ?? err).split('\n')[0] };
  } finally {
    await page.close();
  }
}

let changed = 0;
for (const [slug, place] of targets) {
  const { status, followers, detail } = await check(place.instagram);
  const url = `https://www.threads.com/@${place.instagram}`;
  console.log(
    `${status.padEnd(12)} ${slug.padEnd(24)} ${url}` +
      (followers ? `  (${followers} followers)` : '') +
      (detail ? `  ${detail}` : '')
  );
  // Only ever promote to confirmed / demote to missing. `inconclusive` and
  // `error` say the check failed, not that the account is gone.
  if (write && (status === 'confirmed' || status === 'missing') && place.threads_status !== status) {
    place.threads_status = status;
    if (status === 'confirmed') place.evidence = url;
    changed++;
  }
}

await browser.close();

if (write && changed) {
  writeFileSync(SOCIALS_PATH, JSON.stringify(socials, null, 2) + '\n');
  console.log(`\nUpdated ${changed} place(s) in seeds/socials.json`);
} else if (write) {
  console.log('\nNo status changes.');
}
