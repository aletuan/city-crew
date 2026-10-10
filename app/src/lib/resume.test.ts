import { afterEach, describe, expect, it } from 'vitest';
import {
  dropResume, focusedTab, holdResume, RESUME_TTL_MS, returnTab, takeResume,
} from './resume';

const T0 = 1_000_000;

afterEach(() => { dropResume(); });

describe('takeResume', () => {
  it('hands back the act once, then forgets it', () => {
    const run = () => {};
    holdResume({ tab: 'Explore', run, at: T0 });
    expect(takeResume(T0 + 1000)).toEqual({ tab: 'Explore', run, at: T0 });
    expect(takeResume(T0 + 1000)).toBeNull();
  });

  it('keeps only the last act asked for', () => {
    holdResume({ tab: 'Explore', at: T0 });
    holdResume({ tab: 'Collections', at: T0 + 5 });
    expect(takeResume(T0 + 10)?.tab).toBe('Collections');
  });

  it('is nothing when nothing was held, or when it was dropped', () => {
    expect(takeResume(T0)).toBeNull();
    holdResume({ tab: 'Explore', at: T0 });
    dropResume();
    expect(takeResume(T0)).toBeNull();
  });

  it('keeps an act for fifteen minutes and not a moment longer', () => {
    expect(RESUME_TTL_MS).toBe(15 * 60 * 1000);
    holdResume({ tab: 'Explore', at: T0 });
    expect(takeResume(T0 + RESUME_TTL_MS)).not.toBeNull();
    holdResume({ tab: 'Explore', at: T0 });
    expect(takeResume(T0 + RESUME_TTL_MS + 1)).toBeNull();
  });

  it('refuses a stamp from the future, and forgets it', () => {
    holdResume({ tab: 'Explore', at: T0 + 1 });
    expect(takeResume(T0)).toBeNull();
    expect(takeResume(T0 + 2)).toBeNull();
  });
});

describe('focusedTab', () => {
  it('reads the focused route of the root', () => {
    expect(focusedTab({ index: 1, routes: [{ name: 'Ideas' }, { name: 'Explore' }] })).toBe('Explore');
  });
  it('takes the first route when the root has no index yet', () => {
    expect(focusedTab({ routes: [{ name: 'Ideas' }] })).toBe('Ideas');
  });
  it('is null with no state, or an index past the end', () => {
    expect(focusedTab(undefined)).toBeNull();
    expect(focusedTab({ index: 3, routes: [{ name: 'Ideas' }] })).toBeNull();
  });
});

describe('returnTab', () => {
  it('goes back to the tab the reader was on', () => {
    expect(returnTab({ tab: 'Collections', at: T0 })).toBe('Collections');
  });
  it('goes nowhere from Profile, or from an unknown tab', () => {
    expect(returnTab({ tab: 'Profile', at: T0 })).toBeNull();
    expect(returnTab({ tab: null, at: T0 })).toBeNull();
  });
});
