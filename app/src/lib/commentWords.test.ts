import { describe, expect, it } from 'vitest';
import { REFUSALS } from './comments';
import { refusalWords } from './commentWords';

const en = ((e: string) => e) as Parameters<typeof refusalWords>[1];
const vi = ((_e: string, v: string) => v) as Parameters<typeof refusalWords>[1];

describe('refusalWords', () => {
  it('has a sentence of its own for each refusal a post can meet', () => {
    const own = ['signed_out', 'subject', 'off', 'empty', 'long', 'banned', 'cap', 'parent'] as const;
    const said = own.map((w) => refusalWords(w, en));
    expect(new Set(said).size).toBe(own.length);
    expect(refusalWords('long', en)).toBe('Comments can be up to 500 characters.');
    expect(refusalWords('off', en)).toContain('turned comments off');
  });

  it('says the general thing for the two that are not a post\'s, and for no refusal at all', () => {
    const general = refusalWords(null, en);
    expect(general).toContain('Check your connection');
    expect(refusalWords('mention', en)).toBe(general);
    expect(refusalWords('not_yours', en)).toBe(general);
    // Every word the server can raise is answered by one or the other.
    for (const w of REFUSALS) expect(refusalWords(w, en)).toBeTruthy();
  });
});

describe('refusalWords, in Vietnamese', () => {
  it('speaks the reader\'s language', () => {
    expect(refusalWords('cap', vi)).toBe('Bạn đã đạt giới hạn bình luận hôm nay. Hãy thử lại vào ngày mai.');
    expect(refusalWords('long', vi)).toBe('Bình luận tối đa 500 ký tự.');
  });
});
