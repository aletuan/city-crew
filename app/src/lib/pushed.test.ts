import { describe, expect, it } from 'vitest';
import { isPushed } from './pushed';

describe('isPushed', () => {
  it('is the stack’s own position: over its first page, or on it', () => {
    expect(isPushed({ getState: () => ({ index: 1 }) })).toBe(true);
    expect(isPushed({ getState: () => ({ index: 3 }) })).toBe(true);
    expect(isPushed({ getState: () => ({ index: 0 }) })).toBe(false);
  });

  // A navigation object with no state to read — a test's stand-in, or a
  // page read with no navigator — is nobody's pushed page.
  it('is false with no state, no index, or no way to ask', () => {
    expect(isPushed({ getState: () => undefined })).toBe(false);
    expect(isPushed({ getState: () => ({}) })).toBe(false);
    expect(isPushed({})).toBe(false);
  });
});
