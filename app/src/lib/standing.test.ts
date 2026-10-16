import { describe, expect, it } from 'vitest';
import { percentText, standingIn } from './standing';

describe('standingIn', () => {
  const q = [0, 10, 20, 40, 80];
  it('is the share below, read straight between the quantiles either side', () => {
    expect(standingIn(10, q)).toBe(0.25);
    expect(standingIn(15, q)).toBe(0.375);
    expect(standingIn(30, q)).toBe(0.625);
    expect(standingIn(60, q)).toBe(0.875);
  });
  it('is none at or under the least, and all at or over the most', () => {
    expect(standingIn(0, q)).toBe(0);
    expect(standingIn(-5, q)).toBe(0);
    expect(standingIn(80, q)).toBe(1);
    expect(standingIn(500, q)).toBe(1);
  });
});

describe('percentText', () => {
  it('is to the nearest five', () => {
    expect(percentText(0.78)).toBe(80);
    expect(percentText(0.72)).toBe(70);
    expect(percentText(0.5)).toBe(50);
  });
  // The sharpest photograph ties itself; it is not sharper than all.
  it('never says none or all', () => {
    expect(percentText(1)).toBe(95);
    expect(percentText(0.99)).toBe(95);
    expect(percentText(0)).toBe(5);
    expect(percentText(0.01)).toBe(5);
  });
});
