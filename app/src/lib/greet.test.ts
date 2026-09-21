// Which word of a name a greeting may use, and when it must not use one.

import { describe, expect, it } from 'vitest';
import { greetingName } from './greet';

describe('greetingName', () => {
  // The whole point of the rule. A Vietnamese name runs family, middle,
  // given; the given name is the last word and the only one you greet
  // somebody by. "Chào Lê" is wrong the way "Hi Smith" is wrong.
  it('takes the given name, which in Vietnamese is the last word', () => {
    expect(greetingName('Lê Tuấn Anh')).toBe('Anh');
    expect(greetingName('Nguyễn Thu Trang')).toBe('Trang');
    expect(greetingName('Phạm Thị Hồng Nhung')).toBe('Nhung');
  });

  // Twelve of the thirty-four profiles are one word, which is then both
  // names at once and needs no choosing.
  it('uses a single-word name whole', () => {
    expect(greetingName('Trang')).toBe('Trang');
  });

  // An English name greeted by its last word gives the family name, which
  // is not how English greets — but the profiles this serves are
  // Vietnamese, and the note in the module says so rather than pretending
  // the rule is universal. Pinned so the limit is visible rather than
  // discovered.
  it('gives an English name its family name, which the module admits to', () => {
    expect(greetingName('John Smith')).toBe('Smith');
  });

  // Three profiles write their name in lower case. Capitalised at the
  // front only: the rest is left exactly as typed, because somebody who
  // writes "thuý" has still written their name.
  it('capitalises the first letter and leaves the rest alone', () => {
    expect(greetingName('nguyễn thu trang')).toBe('Trang');
    expect(greetingName('đức')).toBe('Đức');
    expect(greetingName('Lê McDonald')).toBe('McDonald');
  });

  // Whatever the keyboard and the paste buffer left behind.
  it('survives padding and doubled spaces', () => {
    expect(greetingName('   Lê   Thu   Trang   ')).toBe('Trang');
    expect(greetingName('Trang\n')).toBe('Trang');
  });

  // One profile's last word does not begin with a letter. "Chào 2024," is
  // worse than "Chào bạn," — so there is no name here and the panel says
  // so by falling back.
  it('is null when the last word is not a name it can greet', () => {
    expect(greetingName('user 2024')).toBeNull();
    expect(greetingName('🙂')).toBeNull();
    expect(greetingName('Trang 123')).toBeNull();
  });

  it('is null for nothing at all', () => {
    expect(greetingName('')).toBeNull();
    expect(greetingName('   ')).toBeNull();
    expect(greetingName(null)).toBeNull();
    expect(greetingName(undefined)).toBeNull();
  });

  // A character outside the basic plane is one letter, not two halves of
  // one — which is why the first character is taken with `Array.from`.
  // `[0]` would have handed `toUpperCase` half a surrogate pair and glued
  // the other half back on behind it.
  it('does not cut a surrogate pair in half', () => {
    expect(greetingName('𐐨rang')).toBe('𐐀rang');
  });

  // And a character that merely looks like a letter is not one. The
  // mathematical alphanumerics have no case mapping at all, which is the
  // same test the guard above uses, so they fall out as "no name here".
  it('refuses a glyph that looks like a letter but has no case', () => {
    expect(greetingName('𝐓rang')).toBeNull();
  });
});
