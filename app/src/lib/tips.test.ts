import { describe, expect, it } from 'vitest';
import { EMPTY_LOG, markShown, MAX_SHOWS, parseLog, pickTip, retire, TIPS_KEY, tipsKey, type TipId, type TipLog } from './tips';

const ALL: TipId[] = ['reorder', 'publish', 'edit', 'add'];

/** Show whatever `pickTip` chooses, `n` times, and say what was shown. */
const visits = (eligible: TipId[], n: number, log: TipLog = EMPTY_LOG) => {
  const seen: (TipId | null)[] = [];
  let l = log;
  for (let i = 0; i < n; i++) {
    const tip = pickTip(eligible, l);
    seen.push(tip);
    if (tip) l = markShown(l, tip);
  }
  return { seen, log: l };
};

describe('pickTip', () => {
  it('shows every tip once before any tip twice, in the screen\'s order', () => {
    expect(visits(ALL, 4).seen).toEqual(['reorder', 'publish', 'edit', 'add']);
  });

  it('then comes round again in the same order', () => {
    expect(visits(ALL, 6).seen.slice(4)).toEqual(['reorder', 'publish']);
  });

  it('never shows the same tip twice running while there is another', () => {
    const { seen } = visits(['edit', 'add'], 5);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
  });

  // What applies changes between visits: a list made public no longer
  // has a publish tip. The rotation carries on over what is left.
  it('picks up where it left off when what applies changes', () => {
    const { log } = visits(ALL, 2); // reorder, publish
    expect(pickTip(['reorder', 'edit', 'add'], log)).toBe('edit');
    // A tip that has not applied for a while is not owed a turn ahead of
    // one that has never been seen.
    expect(pickTip(['publish', 'add'], markShown(log, 'edit'))).toBe('add');
  });

  it('skips a retired tip', () => {
    expect(pickTip(ALL, retire(EMPTY_LOG, 'reorder'))).toBe('publish');
  });

  it('has nothing to show when everything that applies has retired, or nothing applies', () => {
    let log = EMPTY_LOG;
    for (const id of ALL) log = retire(log, id);
    expect(pickTip(ALL, log)).toBeNull();
    expect(pickTip([], EMPTY_LOG)).toBeNull();
  });

  it('keeps showing the only tip left', () => {
    expect(visits(['edit'], 3).seen).toEqual(['edit', 'edit', 'edit']);
  });
});

describe('markShown and retire', () => {
  it('stamps the tip with the counter, then moves the counter on', () => {
    const log = markShown(markShown(EMPTY_LOG, 'edit'), 'add');
    expect(log).toEqual({ seq: 2, last: { edit: 0, add: 1 }, shown: { edit: 1, add: 1 }, retired: [] });
  });

  it('retires a tip once however often it is asked', () => {
    const once = retire(EMPTY_LOG, 'edit');
    expect(retire(once, 'edit')).toBe(once);
    expect(once.retired).toEqual(['edit']);
  });

  it('never changes the log it was given', () => {
    const log = markShown(EMPTY_LOG, 'edit');
    retire(log, 'add');
    markShown(log, 'add');
    expect(log).toEqual({ seq: 1, last: { edit: 0 }, shown: { edit: 1 }, retired: [] });
    expect(EMPTY_LOG).toEqual({ seq: 0, last: {}, shown: {}, retired: [] });
  });
});

describe('parseLog', () => {
  it('reads nothing stored as an empty log', () => {
    expect(parseLog(null)).toEqual(EMPTY_LOG);
  });

  it('reads back what was written', () => {
    const log = retire(markShown(EMPTY_LOG, 'edit'), 'add');
    expect(parseLog(JSON.stringify(log))).toEqual(log);
  });

  it('starts over from a record that does not parse', () => {
    expect(parseLog('{not json')).toEqual(EMPTY_LOG);
    expect(parseLog('null')).toEqual(EMPTY_LOG);
  });

  // A later build may know tips this one does not, and a hand-edited or
  // half-written record may hold anything. Keep what is usable.
  it('keeps only what it can use', () => {
    expect(parseLog(JSON.stringify({
      seq: 'seven',
      last: { edit: 3, rename: 4, add: 'x' },
      shown: { edit: 2, rename: 1, add: 'x' },
      retired: ['publish', 'rename', 5],
    }))).toEqual({ seq: 0, last: { edit: 3 }, shown: { edit: 2 }, retired: ['publish'] });
    // A record from before the cap: no counts, so its tips count from none.
    expect(parseLog(JSON.stringify({ seq: 4, retired: 'publish' }))).toEqual({ seq: 4, last: {}, shown: {}, retired: [] });
  });

  // The reorder tip's own flag, from before there was more than one tip.
  it('carries over a reorder tip that was already retired', () => {
    expect(parseLog(null, '1').retired).toEqual(['reorder']);
    expect(parseLog(JSON.stringify(retire(EMPTY_LOG, 'reorder')), '1').retired).toEqual(['reorder']);
    expect(parseLog(null, null).retired).toEqual([]);
  });
});

// One record per account, and the device's own for a guest: a second
// account on the same phone met every tip the first had retired.
describe('where a reader\'s record is kept', () => {
  it('is the device\'s key for a guest', () => {
    expect(tipsKey(null)).toBe(TIPS_KEY);
    expect(tipsKey(undefined)).toBe(TIPS_KEY);
    expect(tipsKey('')).toBe(TIPS_KEY);
  });

  it('is a key of its own for each account', () => {
    expect(tipsKey('u1')).toBe(`${TIPS_KEY}:u1`);
    expect(tipsKey('u1')).not.toBe(tipsKey('u2'));
  });
});

// Read three times and neither acted on nor closed: the reader knows it,
// or does not want it.
describe('the cap', () => {
  it('shows a tip three times and then no more', () => {
    expect(MAX_SHOWS).toBe(3);
    expect(visits(['edit'], 5).seen).toEqual(['edit', 'edit', 'edit', null, null]);
  });

  it('carries on with the others once one has had its three', () => {
    expect(visits(['edit', 'add'], 7).seen).toEqual(['edit', 'add', 'edit', 'add', 'edit', 'add', null]);
  });

  it('counts each tip on its own', () => {
    const log = markShown(markShown(markShown(EMPTY_LOG, 'edit'), 'add'), 'edit');
    expect(log.shown).toEqual({ edit: 2, add: 1 });
    expect(pickTip(['edit'], log)).toBe('edit');
    expect(pickTip(['edit'], markShown(log, 'edit'))).toBeNull();
  });
});
