import { describe, expect, it, vi } from 'vitest';
import { changes, commentsChanged, onChange } from './commentsChanged';

describe('commentsChanged', () => {
  it('counts each change and tells everyone listening, until they stop', () => {
    const a = vi.fn();
    const b = vi.fn();
    const stopA = onChange(a);
    onChange(b);
    const before = changes();
    commentsChanged();
    expect(changes()).toBe(before + 1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    stopA();
    commentsChanged();
    expect(changes()).toBe(before + 2);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });
});
