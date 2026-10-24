import { describe, expect, it } from 'vitest';
import { DAILY_CAPS, DAILY_LIMIT, isDailyLimit, refusedByPolicy, RLS_REFUSED, searchLimitWords } from './quota';

describe('refusedByPolicy', () => {
  it('knows the SQLSTATE PostgREST reports a refused row with', () => {
    expect(refusedByPolicy({ code: RLS_REFUSED, message: 'new row violates row-level security policy for table "collections"' })).toBe(true);
  });

  // Storage reports its policies with the sentence and no code.
  it('knows the sentence when there is no code', () => {
    expect(refusedByPolicy({ message: 'new row violates row-level security policy' })).toBe(true);
    expect(refusedByPolicy({ code: null, message: 'New Row Violates Row-Level Security Policy' })).toBe(true);
  });

  it('leaves every other failure alone', () => {
    expect(refusedByPolicy({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(false);
    expect(refusedByPolicy({ message: 'Network request failed' })).toBe(false);
    expect(refusedByPolicy({ code: '23505' })).toBe(false);
    expect(refusedByPolicy(null)).toBe(false);
    expect(refusedByPolicy(undefined)).toBe(false);
  });
});

describe('isDailyLimit', () => {
  it('recognises the name a writer throws, and nothing else', () => {
    expect(isDailyLimit(new Error(DAILY_LIMIT))).toBe(true);
    expect(isDailyLimit(new Error('duplicate key'))).toBe(false);
    expect(isDailyLimit(DAILY_LIMIT)).toBe(false);
  });
});

describe('DAILY_CAPS', () => {
  // A copy of the migration's numbers. If this fails, one side moved.
  it('says what the policies enforce', () => {
    expect(DAILY_CAPS).toEqual({ collections: 20, placesIntoLists: 300, checkinsPerPlace: 3 });
  });
});

describe('searchLimitWords', () => {
  const en = (e: string) => e;
  const vi = (_e: string, v: string) => v;

  // The reader's own allowance names its number; everyone's does not,
  // and does not say "you" — the reader may have searched twice.
  it('names the reader\'s own number when the allowance spent is theirs', () => {
    expect(searchLimitWords('account', 60, en)).toEqual({
      title: 'That is enough for today',
      body: 'You can search Google 60 times a day. Come back tomorrow.',
    });
    expect(searchLimitWords('account', 30, vi).body).toBe('Mỗi ngày bạn tìm trên Google được 30 lần. Mai quay lại nhé.');
  });

  it('says it is the app\'s day, not the reader\'s, when everyone\'s is spent', () => {
    const w = searchLimitWords('app', 60, en);
    expect(w.title).toBe('Google search is resting');
    expect(w.body).toBe('City Crew has used all of today\'s searches on Google. Try again tomorrow.');
    expect(w.body).not.toContain('60');
  });
});
