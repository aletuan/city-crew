import { describe, expect, it } from 'vitest';
import { COLLECTION_VIEW_KEY, GRID_NOTICE_KEY, READER_PREFS, readerKey } from './readerPrefs';

describe('readerKey', () => {
  it('is the reader’s own key when somebody is signed in', () => {
    expect(readerKey(COLLECTION_VIEW_KEY, 'u1')).toBe('citycrew.collection.view:u1');
  });

  // The phone's key, unchanged, so a choice made signed out before this
  // existed is still read signed out.
  it('is the phone’s key when nobody is', () => {
    expect(readerKey(COLLECTION_VIEW_KEY, null)).toBe('citycrew.collection.view');
  });

  it('is nothing while it is not yet known who is reading', () => {
    expect(readerKey(COLLECTION_VIEW_KEY, undefined)).toBeNull();
  });

  it('lists both values kept per reader', () => {
    expect(READER_PREFS).toEqual([COLLECTION_VIEW_KEY, GRID_NOTICE_KEY]);
  });
});
