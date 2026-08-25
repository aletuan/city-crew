import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('./testing').fakeSupabase> | null }));
vi.mock('./supabase', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

import type { TraceMark } from './trace';
import { buildRow, makeReporter, reportStartup, sendRow, type TraceRow } from './tracereport';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

const mark = (name: string, ms: number): TraceMark => ({ name, at: 1_000_000 + ms, ms });
const DEVICE = { platform: 'ios', osVersion: '18.1', isDev: false };

describe('buildRow', () => {
  it('files the marks by elapsed ms and totals on the last of them', () => {
    const row = buildRow([mark('theme:ready', 180), mark('explore:content', 1920)], DEVICE);
    expect(row).toEqual({
      platform: 'ios',
      os_version: '18.1',
      is_dev: false,
      total_ms: 1920,
      marks: [
        { name: 'theme:ready', ms: 180 },
        { name: 'explore:content', ms: 1920 },
      ],
    });
  });

  it('leaves the raw clock readings behind', () => {
    const row = buildRow([mark('a', 5)], DEVICE)!;
    expect(row.marks[0]).not.toHaveProperty('at');
  });

  it('has nothing to say about a trace that marked nothing', () => {
    expect(buildRow([], DEVICE)).toBeNull();
  });
});

describe('makeReporter', () => {
  it('sends once; every later call is a no-op', () => {
    const send = vi.fn(() => Promise.resolve());
    const report = makeReporter(true, send);
    report([mark('a', 5)], DEVICE);
    report([mark('a', 5), mark('b', 9)], DEVICE);
    expect(send).toHaveBeenCalledOnce();
  });

  it('disabled, it sends nothing at all', () => {
    const send = vi.fn(() => Promise.resolve());
    makeReporter(false, send)([mark('a', 5)], DEVICE);
    expect(send).not.toHaveBeenCalled();
  });

  it('does not spend its one send on an empty trace', () => {
    const send = vi.fn(() => Promise.resolve());
    const report = makeReporter(true, send);
    report([], DEVICE);
    report([mark('a', 5)], DEVICE);
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ total_ms: 5 }));
  });

  it('a refused send surfaces nowhere and is not retried', async () => {
    const send = vi.fn((_row: TraceRow) => Promise.reject(new Error('rls said no')));
    const report = makeReporter(true, send);
    report([mark('a', 5)], DEVICE);
    await Promise.resolve();
    report([mark('a', 5)], DEVICE);
    expect(send).toHaveBeenCalledOnce();
  });
});

describe('reportStartup', () => {
  it('inserts the row into startup_traces and swallows the answer', async () => {
    fake().replies({ data: null, error: null });
    reportStartup([mark('explore:content', 1920)], { platform: 'android', osVersion: '35', isDev: true });
    await Promise.resolve();
    expect(fake().log).toEqual([
      expect.objectContaining({
        table: 'startup_traces',
        op: 'insert',
        payload: expect.objectContaining({ platform: 'android', is_dev: true, total_ms: 1920 }),
      }),
    ]);
  });

  it('a refusal becomes a rejection, for the reporter to swallow', async () => {
    fake().replies({ data: null, error: { message: 'no such table' } });
    await expect(sendRow(buildRow([mark('a', 5)], DEVICE)!)).rejects.toThrow('no such table');
  });
});
