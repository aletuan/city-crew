import { describe, expect, it } from 'vitest';
import { ARRIVE_BASE_MS, ARRIVE_ROWS, ARRIVE_ROW_MS, arriveDelay, arrives, detailAnimation, measureWindow, usableRect } from './coverMorph';

describe('usableRect', () => {
  it('takes a laid-out rectangle', () => {
    expect(usableRect({ x: 10, y: 20, w: 100, h: 50 })).toBe(true);
  });
  it('refuses a view that is not laid out', () => {
    expect(usableRect({ x: 0, y: 0, w: 0, h: 50 })).toBe(false);
    expect(usableRect({ x: 0, y: 0, w: 100, h: 0 })).toBe(false);
  });
  it('refuses a measurement that is not a number', () => {
    expect(usableRect({ x: NaN, y: 0, w: 100, h: 50 })).toBe(false);
    expect(usableRect({ x: 0, y: Infinity, w: 100, h: 50 })).toBe(false);
  });
});

describe('arriveDelay', () => {
  it('starts the first row after the cover has begun', () => {
    expect(arriveDelay(0)).toBe(ARRIVE_BASE_MS);
  });
  it('starts each row a step after the one above', () => {
    expect(arriveDelay(1) - arriveDelay(0)).toBe(ARRIVE_ROW_MS);
    expect(arriveDelay(3)).toBe(ARRIVE_BASE_MS + 3 * ARRIVE_ROW_MS);
  });
});

describe('arrives', () => {
  it('arrives inside the first rows', () => {
    expect(arrives(0)).toBe(true);
    expect(arrives(ARRIVE_ROWS - 1)).toBe(true);
  });
  it('does not arrive past them', () => {
    expect(arrives(ARRIVE_ROWS)).toBe(false);
  });
});

describe('measureWindow', () => {
  it('reports where the view stands', async () => {
    const node = { measureInWindow: (done: (x: number, y: number, w: number, h: number) => void) => done(1, 2, 3, 4) };
    expect(await measureWindow(node)).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });
  it('reports nothing for a view that is not there', async () => {
    expect(await measureWindow(null)).toBeNull();
    expect(await measureWindow(undefined)).toBeNull();
  });
});

describe('detailAnimation', () => {
  it('fades a page opened from a tile', () => {
    expect(detailAnimation({ rect: { x: 1, y: 2, w: 3, h: 4 }, uri: 'a.jpg' })).toBe('fade');
  });
  it('slides a page opened any other way', () => {
    expect(detailAnimation(undefined)).toBe('default');
  });
});
