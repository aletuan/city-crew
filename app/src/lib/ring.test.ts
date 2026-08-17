import { describe, expect, it } from 'vitest';
import { arcSweep, MIN_ARC, mixHex, sampleSweep, visibleSweep, type Stop } from './ring';

// The ring's own ramp, so the tests are about the colours that ship
// rather than about toy inputs.
const SWEEP: Stop[] = [
  { at: 0, hex: '#ff6f5b' },
  { at: 0.14, hex: '#ff8b72' },
  { at: 0.32, hex: '#ff9a5c' },
  { at: 0.58, hex: '#f2b441' },
  { at: 1, hex: '#a9c46a' },
];

describe('mixHex', () => {
  it('returns the ends at the ends', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  it('meets in the middle', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('keeps two digits per channel', () => {
    // The bug this catches is a channel below 16 losing its leading zero
    // and shortening the string, which yields a colour nobody can parse.
    expect(mixHex('#000000', '#0a0a0a', 0.5)).toBe('#050505');
    expect(mixHex('#000000', '#ffffff', 0.02)).toBe('#050505');
  });

  it('clamps rather than extrapolating', () => {
    expect(mixHex('#204060', '#ffffff', -3)).toBe('#204060');
    expect(mixHex('#204060', '#ffffff', 9)).toBe('#ffffff');
  });
});

describe('sampleSweep', () => {
  it('lands exactly on a declared stop', () => {
    expect(sampleSweep(SWEEP, 0)).toBe('#ff6f5b');
    expect(sampleSweep(SWEEP, 0.14)).toBe('#ff8b72');
    expect(sampleSweep(SWEEP, 0.32)).toBe('#ff9a5c');
    expect(sampleSweep(SWEEP, 0.58)).toBe('#f2b441');
    expect(sampleSweep(SWEEP, 1)).toBe('#a9c46a');
  });

  it('sits between the two stops it falls between', () => {
    // Halfway from #ff9a5c to #f2b441, i.e. t = 0.45.
    expect(sampleSweep(SWEEP, 0.45)).toBe('#f9a74f');
  });

  it('clamps outside the ramp', () => {
    expect(sampleSweep(SWEEP, -1)).toBe('#ff6f5b');
    expect(sampleSweep(SWEEP, 4)).toBe('#a9c46a');
  });

  it('never leaves the ramp on the way across it', () => {
    // Every channel of every sample has to lie between the channel's
    // own minimum and maximum across the stops. A blend that reached
    // outside them would mean the interpolation had gone wrong in a way
    // no single spot-check would show.
    const lo = [0xa9, 0x6f, 0x41];
    const hi = [0xff, 0xc4, 0x72];
    for (let i = 0; i <= 200; i++) {
      const hex = sampleSweep(SWEEP, i / 200);
      for (let c = 0; c < 3; c++) {
        const v = parseInt(hex.slice(1 + c * 2, 3 + c * 2), 16);
        expect(v).toBeGreaterThanOrEqual(lo[c]);
        expect(v).toBeLessThanOrEqual(hi[c]);
      }
    }
  });

  it('handles a ramp of one', () => {
    expect(sampleSweep([{ at: 0, hex: '#123456' }], 0.7)).toBe('#123456');
  });

  // Two stops at the same position have no span to interpolate across.
  // Dividing by that zero would give NaN and a colour of "#NaNNaNNaN";
  // the later stop wins instead, which is what a reader would mean by
  // putting one there.
  it('takes the later stop when two share a position', () => {
    const stops = [{ at: 0, hex: '#000000' }, { at: 0, hex: '#ffffff' }, { at: 1, hex: '#ff0000' }];
    expect(sampleSweep(stops, 0)).toBe('#ffffff');
  });
});

describe('arcSweep', () => {
  it('draws nothing at nothing', () => {
    expect(arcSweep(0)).toEqual([]);
    expect(arcSweep(-0.5)).toEqual([]);
  });

  it('covers exactly the fraction asked for', () => {
    const segs = arcSweep(0.25);
    expect(segs[0].a0).toBe(0);
    expect(segs[segs.length - 1].a1).toBeCloseTo(90, 9);
  });

  it('closes the circle at a full turn', () => {
    const segs = arcSweep(1);
    expect(segs[segs.length - 1].a1).toBeCloseTo(360, 9);
  });

  it('leaves no gap and no overlap between segments', () => {
    const segs = arcSweep(0.62);
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].a0).toBeCloseTo(segs[i - 1].a1, 9);
    }
  });

  it('keeps every segment inside the step, so the banding stays invisible', () => {
    for (const pct of [0.03, 0.2, 0.5, 0.999, 1]) {
      for (const seg of arcSweep(pct, 6)) {
        expect(seg.a1 - seg.a0).toBeLessThanOrEqual(6 + 1e-9);
      }
    }
  });

  it('spends the whole ramp however short the arc', () => {
    // The point of the whole exercise: a level-one account at a fifth of
    // a turn sees the sweep, not one crayon.
    const short = arcSweep(0.2);
    expect(short[0].t).toBeLessThan(0.1);
    expect(short[short.length - 1].t).toBeGreaterThan(0.9);
  });

  it('walks the ramp forwards', () => {
    const segs = arcSweep(0.8);
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].t).toBeGreaterThan(segs[i - 1].t);
    }
  });

  it('still produces a segment for an arc thinner than one step', () => {
    const segs = arcSweep(0.002, 6);
    expect(segs).toHaveLength(1);
    expect(segs[0].t).toBe(0.5);
  });
});

describe('visibleSweep', () => {
  // The failure this exists to catch: a brand new profile drawing a bare
  // track and reading as broken rather than as new.
  it('draws something at nothing', () => {
    const segs = visibleSweep(0);
    expect(segs.length).toBeGreaterThan(0);
    expect(segs[segs.length - 1].a1).toBeCloseTo(MIN_ARC * 360, 9);
  });

  it('draws something for an account somehow below nothing', () => {
    expect(visibleSweep(-1).length).toBeGreaterThan(0);
  });

  it('leaves a real reading alone', () => {
    // 20% is the first step `PER_LEVEL` can produce, and it has to come
    // through untouched or the floor would be rewriting the truth.
    expect(visibleSweep(0.2)).toEqual(arcSweep(0.2));
    expect(visibleSweep(0.999)).toEqual(arcSweep(0.999));
  });

  it('keeps the stub well clear of the first real step', () => {
    // If the floor ever crept up to 20% it would silently claim a save
    // that had not happened.
    expect(MIN_ARC).toBeLessThan(0.2 / 2);
  });

  it('spends the whole ramp on the stub too', () => {
    const segs = visibleSweep(0);
    expect(segs[0].t).toBeLessThan(0.3);
    expect(segs[segs.length - 1].t).toBeGreaterThan(0.7);
  });
});
