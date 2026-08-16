import { describe, expect, it } from 'vitest';
import {
  Batch, IDLE_BATCH, finished, heldCount, locksRow,
} from './batch';

const batch = (state: Batch['state'], over = { }): Batch => ({ ...IDLE_BATCH, state, ...over });

describe('locksRow', () => {
  it('locks a row that has been acted on', () => {
    expect(locksRow('running')).toBe(true);
    expect(locksRow('done')).toBe(true);
    expect(locksRow('skipped')).toBe(true);
    expect(locksRow('failed')).toBe(true);
  });

  // The two that were never attempted. Before `held` existed, a run
  // stopped by the daily cap put its remaining rows back to `queued` and
  // the row rendered them unpressable — counted by the button, impossible
  // to untick.
  it('leaves a row alone while it has not been attempted', () => {
    expect(locksRow('queued')).toBe(false);
    expect(locksRow('held')).toBe(false);
  });

  it('leaves a row with no batch at all alone', () => {
    expect(locksRow(undefined)).toBe(false);
  });
});

describe('heldCount', () => {
  it('counts only the ones the cap stopped', () => {
    expect(heldCount(batch({ a: 'done', b: 'held', c: 'held', d: 'failed' }))).toBe(2);
  });

  it('is zero for a run nothing held up', () => {
    expect(heldCount(batch({ a: 'done', b: 'skipped' }))).toBe(0);
    expect(heldCount(IDLE_BATCH)).toBe(0);
  });
});

describe('finished', () => {
  it('is false before the first run', () => {
    expect(finished(IDLE_BATCH)).toBe(false);
  });

  it('is false while one is going', () => {
    expect(finished(batch({ a: 'running' }, { running: true, total: 2 }))).toBe(false);
  });

  // The header said "ADDING 5 · 2 DONE" long after the run had stopped,
  // because it asked whether a batch existed rather than whether one was
  // still going.
  it('is true once a run has stopped', () => {
    expect(finished(batch({ a: 'done' }, { running: false, total: 2, done: 2 }))).toBe(true);
  });
});
