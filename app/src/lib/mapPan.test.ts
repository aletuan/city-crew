import { describe, expect, it } from 'vitest';
import { PAN_EDGE, panTarget } from './mapPan';

// 400×800 points over 0.04° × 0.08°: 10 000 points a degree both ways.
const region = { latitude: 10, longitude: 106, latitudeDelta: 0.08, longitudeDelta: 0.04 };
const view = { width: 400, height: 800 };
const pad = { top: 20, right: 40, bottom: 200, left: 40 };
// Inside box, from the middle: x −160…160, y −380…200.
const pin = (dx: number, dy: number) => ({ lng: 106 + dx / 10000, lat: 10 - dy / 10000 });

describe('panTarget', () => {
  it('stays put for a pin inside the padded box', () => {
    expect(panTarget(region, view, pad, pin(0, 0))).toBeNull();
    expect(panTarget(region, view, pad, pin(-159, -379))).toBeNull();
    expect(panTarget(region, view, pad, pin(159, 199))).toBeNull();
  });

  it('moves right, by what brings the pin PAN_EDGE inside the right line', () => {
    const t = panTarget(region, view, pad, pin(200, 0))!;
    expect(t.latitude).toBeCloseTo(10, 9);
    expect(t.longitude).toBeCloseTo(106 + (200 - (160 - PAN_EDGE)) / 10000, 9);
  });

  it('lands the pin 32 points inside the line, as written in the comment', () => {
    expect(panTarget(region, view, pad, pin(200, 0))!.longitude).toBeCloseTo(106.0072, 9);
  });

  it('moves left', () => {
    const t = panTarget(region, view, pad, pin(-200, 0))!;
    expect(t.longitude).toBeCloseTo(106 + (-200 - (-160 + PAN_EDGE)) / 10000, 9);
  });

  it('moves down under the strip, the padded foot', () => {
    const t = panTarget(region, view, pad, pin(0, 300))!;
    expect(t.longitude).toBeCloseTo(106, 9);
    expect(t.latitude).toBeCloseTo(10 - (300 - (200 - PAN_EDGE)) / 10000, 9);
  });

  it('moves up', () => {
    const t = panTarget(region, view, pad, pin(0, -400))!;
    expect(t.latitude).toBeCloseTo(10 - (-400 - (-380 + PAN_EDGE)) / 10000, 9);
  });

  it('moves on both axes for a pin off a corner', () => {
    const t = panTarget(region, view, pad, pin(300, 300))!;
    expect(t.longitude).toBeGreaterThan(106);
    expect(t.latitude).toBeLessThan(10);
  });
});
