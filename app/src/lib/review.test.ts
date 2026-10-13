import { describe, expect, it } from 'vitest';
import {
  afterAsk, CHECKINS_BEFORE_ASK, EMPTY_MEMO, mayAsk, parseMemo, REVIEW_GAP_DAYS, shouldAsk, TRIPS_BEFORE_ASK, worthAsking,
} from './review';

const NOW = new Date('2026-10-12T10:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

describe('parseMemo', () => {
  it('reads nothing as a phone never asked', () => {
    expect(parseMemo(null)).toEqual(EMPTY_MEMO);
    expect(parseMemo('')).toEqual(EMPTY_MEMO);
  });
  it('reads garbage, non-objects and null as never asked', () => {
    expect(parseMemo('{nope')).toEqual(EMPTY_MEMO);
    expect(parseMemo('42')).toEqual(EMPTY_MEMO);
    expect(parseMemo('null')).toEqual(EMPTY_MEMO);
  });
  it('keeps what it can read and drops what it cannot', () => {
    expect(parseMemo(JSON.stringify({ askedAt: '2026-06-01T00:00:00Z', askedVersion: '1.0.8', tripsSaved: 3.7 })))
      .toEqual({ askedAt: '2026-06-01T00:00:00Z', askedVersion: '1.0.8', tripsSaved: 3 });
    expect(parseMemo(JSON.stringify({ askedAt: 5, askedVersion: '', tripsSaved: -2 }))).toEqual(EMPTY_MEMO);
    expect(parseMemo(JSON.stringify({ tripsSaved: 'two' }))).toEqual(EMPTY_MEMO);
    expect(parseMemo(JSON.stringify({ tripsSaved: Infinity }))).toEqual(EMPTY_MEMO);
  });
});

describe('worthAsking', () => {
  it('waits for the third check-in', () => {
    expect(worthAsking({ kind: 'checkin', total: CHECKINS_BEFORE_ASK - 1 })).toBe(false);
    expect(worthAsking({ kind: 'checkin', total: CHECKINS_BEFORE_ASK })).toBe(true);
    expect(worthAsking({ kind: 'checkin', total: 40 })).toBe(true);
  });
  it('skips the first saved plan, whose save raises the notification sheet', () => {
    expect(worthAsking({ kind: 'trip', total: 1 })).toBe(false);
    expect(worthAsking({ kind: 'trip', total: TRIPS_BEFORE_ASK })).toBe(true);
  });
});

describe('mayAsk', () => {
  it('never asks without a binary version', () => {
    expect(mayAsk(EMPTY_MEMO, null, NOW)).toBe(false);
  });
  it('asks a phone never asked', () => {
    expect(mayAsk(EMPTY_MEMO, '1.0.8', NOW)).toBe(true);
  });
  it('never asks twice for one binary, however long ago', () => {
    expect(mayAsk({ ...EMPTY_MEMO, askedAt: daysAgo(400), askedVersion: '1.0.8' }, '1.0.8', NOW)).toBe(false);
  });
  it('waits out the gap after an ask on another version', () => {
    const memo = (d: number) => ({ ...EMPTY_MEMO, askedAt: daysAgo(d), askedVersion: '1.0.8' });
    expect(mayAsk(memo(REVIEW_GAP_DAYS - 1), '1.0.9', NOW)).toBe(false);
    expect(mayAsk(memo(REVIEW_GAP_DAYS), '1.0.9', NOW)).toBe(true);
  });
  it('treats a version with no date, or a date it cannot read, as free to ask', () => {
    expect(mayAsk({ ...EMPTY_MEMO, askedVersion: '1.0.8' }, '1.0.9', NOW)).toBe(true);
    expect(mayAsk({ ...EMPTY_MEMO, askedAt: 'yesterday', askedVersion: '1.0.8' }, '1.0.9', NOW)).toBe(true);
  });
});

describe('shouldAsk and afterAsk', () => {
  it('needs both the moment and the history', () => {
    expect(shouldAsk(EMPTY_MEMO, { kind: 'checkin', total: 3 }, '1.0.8', NOW)).toBe(true);
    expect(shouldAsk(EMPTY_MEMO, { kind: 'checkin', total: 1 }, '1.0.8', NOW)).toBe(false);
    expect(shouldAsk(EMPTY_MEMO, { kind: 'checkin', total: 3 }, null, NOW)).toBe(false);
  });
  it('remembers the ask and keeps the trip count', () => {
    const m = afterAsk({ ...EMPTY_MEMO, tripsSaved: 4 }, '1.0.8', NOW);
    expect(m).toEqual({ askedAt: NOW.toISOString(), askedVersion: '1.0.8', tripsSaved: 4 });
    expect(shouldAsk(m, { kind: 'trip', total: 5 }, '1.0.8', NOW)).toBe(false);
  });
});
