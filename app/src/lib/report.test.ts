import { describe, expect, it } from 'vitest';
import {
  cleanNote, isReportReason, NOTE_MAX, REPORT_REASONS, reportable,
} from './report';

describe('the reasons', () => {
  it('are the four the table accepts, in sheet order', () => {
    expect(REPORT_REASONS).toEqual(['spam', 'offensive', 'impersonation', 'other']);
  });

  it('recognises its own and nothing else', () => {
    for (const r of REPORT_REASONS) expect(isReportReason(r)).toBe(true);
    expect(isReportReason('rude')).toBe(false);
    expect(isReportReason('')).toBe(false);
  });
});

describe('cleanNote', () => {
  it('trims, and an empty note is no note', () => {
    expect(cleanNote('  spam link  ')).toBe('spam link');
    expect(cleanNote('   ')).toBeNull();
    expect(cleanNote('')).toBeNull();
    expect(cleanNote(null)).toBeNull();
    expect(cleanNote(undefined)).toBeNull();
  });

  it('caps at what the column will take', () => {
    expect(cleanNote('x'.repeat(NOTE_MAX + 50))).toHaveLength(NOTE_MAX);
  });
});

describe('reportable', () => {
  it('a stranger’s profile, yes; your own, never', () => {
    expect(reportable({ kind: 'profile', id: 'them' }, 'me')).toBe(true);
    expect(reportable({ kind: 'profile', id: 'me' }, 'me')).toBe(false);
  });

  it('somebody else’s list, yes; your own is yours to delete', () => {
    expect(reportable({ kind: 'collection', id: 'c1', ownerId: 'them' }, 'me')).toBe(true);
    expect(reportable({ kind: 'collection', id: 'c1', ownerId: 'me' }, 'me')).toBe(false);
  });

  it('the desk’s own editorial lists have no owner to report', () => {
    expect(reportable({ kind: 'collection', id: 'c1', ownerId: null }, 'me')).toBe(false);
  });

  it('signed out, nothing is reportable — the policy needs a reporter', () => {
    expect(reportable({ kind: 'profile', id: 'them' }, null)).toBe(false);
    expect(reportable({ kind: 'collection', id: 'c1', ownerId: 'them' }, undefined)).toBe(false);
  });
});
