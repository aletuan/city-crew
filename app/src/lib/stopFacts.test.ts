// Whether a plan's stops share one district — the question the options
// card asks before it names the district under each stop.

import { describe, expect, it } from 'vitest';
import { sharedArea } from './stopFacts';

describe('sharedArea', () => {
  const at = (neighborhood_en: string | null) => ({ neighborhood_en });

  it('is true when every stop sits in one district', () => {
    expect(sharedArea([at('Melbourne City'), at('Melbourne City'), at('Melbourne City')])).toBe(true);
  });

  it('is false the moment one stop is elsewhere', () => {
    expect(sharedArea([at('Hoàn Kiếm'), at('Hoàn Kiếm'), at('Tây Hồ')])).toBe(false);
    expect(sharedArea([at('Hoàn Kiếm'), at(null)])).toBe(false);
  });

  it('counts unknown districts as one district, and an empty plan as one too', () => {
    expect(sharedArea([at(null), at(null)])).toBe(true);
    expect(sharedArea([])).toBe(true);
  });
});
