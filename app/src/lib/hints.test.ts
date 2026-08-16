import { describe, expect, it } from 'vitest';
import { hintArea } from './hints';

const at = (neighborhood_en: string | null) => ({ neighborhood_en });

describe('hintArea', () => {
  it('names the busiest area, because an example has to work', () => {
    expect(hintArea([at('Ba Đình'), at('Hoàn Kiếm'), at('Hoàn Kiếm')])).toBe('Hoàn Kiếm');
  });

  // A hint that rewrites itself between two renders of the same catalog is
  // a hint the reader stops trusting.
  it('breaks ties on name, so it does not move under the reader', () => {
    expect(hintArea([at('Tây Hồ'), at('Ba Đình')])).toBe('Ba Đình');
    expect(hintArea([at('Ba Đình'), at('Tây Hồ')])).toBe('Ba Đình');
  });

  it('ignores places with no area', () => {
    expect(hintArea([at(null), at('  '), at('Ba Đình')])).toBe('Ba Đình');
  });

  it('trims the name it returns', () => {
    expect(hintArea([at('  Ba Đình  ')])).toBe('Ba Đình');
  });

  // Inventing "try Hoàn Kiếm" for a city that has no Hoàn Kiếm is exactly
  // the failure this function exists to avoid, so it says nothing instead
  // and the caller drops that half of the sentence.
  it('has nothing to suggest for a catalog with no areas', () => {
    expect(hintArea([])).toBeNull();
    expect(hintArea([at(null), at('')])).toBeNull();
  });
});
