// A read failure, named, and the sentence for each name.

import { describe, expect, it } from 'vitest';
import { classifyLoadFail, isOffline, loadFailStale, loadFailText } from './loadfail';

const en = (e: string) => e;
const vi = (_e: string, v: string) => v;
const ja = (_e: string, _v: string, j?: string) => j ?? '';

describe('classifyLoadFail', () => {
  // The two messages from the screenshots that started this, and the
  // shapes the other platforms use for the same fault.
  it.each([
    'The Internet connection appears to be offline. (at ExpoModulesCore/Promise.swift:56)',
    'Network request failed',
    'TypeError: Failed to fetch',
    'NetworkError when attempting to fetch resource.',
    'The network connection was lost.',
    'The request timed out.',
    'Request timeout',
  ])('names a dropped connection: %s', (m) => {
    expect(classifyLoadFail(m)).toBe('offline');
    expect(isOffline(m)).toBe(true);
  });

  it.each([
    'JWT expired',
    'PGRST301: JWT expired',
    'Invalid JWT',
    'token is expired by 3600 seconds',
  ])('names a lapsed session: %s', (m) => {
    expect(classifyLoadFail(m)).toBe('expired');
  });

  // Not null. A read has one remedy whatever went wrong, so an unknown
  // message still gets a name and a sentence — unlike `authFail`, whose
  // unknowns fall through to the server's words on purpose.
  it('calls everything else other, never null', () => {
    expect(classifyLoadFail('permission denied for table places')).toBe('other');
    expect(classifyLoadFail('boom')).toBe('other');
  });

  it('is null for no failure', () => {
    expect(classifyLoadFail(null)).toBeNull();
    expect(classifyLoadFail(undefined)).toBeNull();
    expect(classifyLoadFail('')).toBeNull();
  });

  // The more specific name wins when a message could read as both.
  it('prefers expired over offline when both could match', () => {
    expect(classifyLoadFail('Network request failed: JWT expired')).toBe('expired');
  });
});

describe('the sentences', () => {
  it('has one per name, in three languages, none of them the server’s words', () => {
    for (const kind of ['offline', 'expired', 'other'] as const) {
      for (const t of [en, vi, ja]) {
        const s = loadFailText(kind, t);
        expect(s.length).toBeGreaterThan(0);
        expect(s).not.toMatch(/jwt|pgrst|swift|fetch/i);
      }
    }
  });

  it('tells the three apart', () => {
    const all = (['offline', 'expired', 'other'] as const).map((k) => loadFailText(k, en));
    expect(new Set(all).size).toBe(3);
  });

  it('has a second half for a screen still showing an older answer', () => {
    expect(loadFailStale(vi)).toBe('Đang hiện dữ liệu đã lưu.');
    expect(loadFailStale(en)).toMatch(/saved/);
  });
});
