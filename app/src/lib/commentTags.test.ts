import { describe, expect, it } from 'vitest';
import {
  caretAfter, charsBefore, offersFor, outgoing, placesNamed, retag, tagQuery, taggableOf, tagged, wordsOf,
  OFFERED, TAGS_MAX, type Offer, type Tag, type TagPerson, type TagPlace,
} from './commentTags';

const person = (at: number, len: number, id = 'u1'): Tag => ({ at, len, person: id, place: null });
const place = (at: number, len: number, id = 'p1'): Tag => ({ at, len, person: null, place: id });
const who = (handle: string, full_name: string | null = null): TagPerson => ({ id: `id-${handle}`, handle, full_name, avatar_url: null });
const where = (name: string): TagPlace => ({ id: `id-${name}`, slug: name.toLowerCase().replace(/ /g, '-'), name });

describe('charsBefore', () => {
  it('counts characters, where the field counts units', () => {
    expect(charsBefore('hello', 3)).toBe(3);
    // The emoji is two units and one character.
    expect(charsBefore('😀 @tr', 6)).toBe(5);
    expect(charsBefore('abc', 99)).toBe(3);
    expect(charsBefore('abc', -1)).toBe(0);
  });
});

describe('retag', () => {
  //            0123456789
  const text = 'hi @trang ok';
  const tags = [person(3, 6)];

  it('leaves a tag that the change came after, and one typed right against its end', () => {
    expect(retag(text, 'hi @trang ok!', tags)).toEqual(tags);
    expect(retag(text, 'hi @trangx ok', tags)).toEqual(tags);
  });

  it('moves a tag the change came before, by as much as the words grew or shrank', () => {
    expect(retag(text, 'oh hi @trang ok', tags)).toEqual([person(6, 6)]);
    expect(retag(text, 'i @trang ok', tags)).toEqual([person(2, 6)]);
    // Right against its first letter: it moves along.
    expect(retag(text, 'hi x@trang ok', tags)).toEqual([person(4, 6)]);
  });

  it('drops a tag whose own letters were touched, and keeps the others', () => {
    const two = [person(3, 6), place(13, 5)];
    //            hi @trang ok @Cong
    const both = 'hi @trang ok @Cong';
    expect(retag(both, 'hi @trng ok @Cong', two)).toEqual([place(12, 5)]);
    expect(retag(both, 'hi @traXng ok @Cong', two)).toEqual([place(14, 5)]);
    // A selection that ran from inside one to inside the other, replaced.
    expect(retag(both, 'hi @trXong', two)).toEqual([]);
  });

  it('measures in characters: an emoji typed before a tag moves it by one', () => {
    expect(retag(text, '😀hi @trang ok', tags)).toEqual([person(4, 6)]);
  });

  it('changes nothing when nothing changed, and clears with the words', () => {
    expect(retag(text, text, tags)).toEqual(tags);
    expect(retag(text, '', tags)).toEqual([]);
  });

  it('takes either reading of a letter typed into a run of itself', () => {
    // "aa @x" → "aaa @x": the a went in somewhere in the run; the tag moves one.
    expect(retag('aa @x', 'aaa @x', [person(3, 2)])).toEqual([person(4, 2)]);
  });
});

describe('caretAfter', () => {
  it('is the end of what was typed', () => {
    expect(caretAfter('hi ', 'hi @')).toBe(4);
    expect(caretAfter('hi  there', 'hi @ there')).toBe(4);
    expect(caretAfter('😀', '😀@')).toBe(2);
    // Into a run of the same letter: after the run, not inside what the two ends share twice over.
    expect(caretAfter('aa @x', 'aaa @x')).toBe(3);
  });

  it('is the point of what was deleted', () => {
    expect(caretAfter('hi @tr', 'hi @t')).toBe(5);
    expect(caretAfter('hi @tr there', 'hi  there')).toBe(3);
  });
});

describe('tagQuery', () => {
  it('reads the "@" being typed at the caret, and its letters so far', () => {
    expect(tagQuery('@', 1, [])).toEqual({ at: 0, query: '' });
    expect(tagQuery('hi @tr', 6, [])).toEqual({ at: 3, query: 'tr' });
    expect(tagQuery('line\n@tr', 8, [])).toEqual({ at: 5, query: 'tr' });
    // Only up to the caret: the rest of the word is not the query.
    expect(tagQuery('hi @trang', 5, [])).toEqual({ at: 3, query: 't' });
    expect(tagQuery('😀 @cộ', 5, [])).toEqual({ at: 2, query: 'cộ' });
  });

  it('is nothing with no "@" in the word at the caret', () => {
    expect(tagQuery('', 0, [])).toBeNull();
    expect(tagQuery('hello', 5, [])).toBeNull();
    expect(tagQuery('@tr and', 7, [])).toBeNull();
    expect(tagQuery('@tr ', 4, [])).toBeNull();
  });

  it('is nothing for an "@" in the middle of a word', () => {
    expect(tagQuery('mail a@b', 8, [])).toBeNull();
  });

  it('is nothing for the "@" of a tag already made', () => {
    expect(tagQuery('hi @trang', 9, [person(3, 6)])).toBeNull();
    // But a second "@" after it is its own.
    expect(tagQuery('hi @trang @l', 12, [person(3, 6)])).toEqual({ at: 10, query: 'l' });
  });

  it('holds a caret outside the words to the words', () => {
    expect(tagQuery('@tr', 99, [])).toEqual({ at: 0, query: 'tr' });
    expect(tagQuery('@tr', -5, [])).toBeNull();
  });
});

describe('offersFor', () => {
  const people = [who('trang', 'Trang Lê'), who('long96', 'Long Trần'), who('tuananh', 'Tuấn Anh'), who('dang', null)];
  const places = [where('Cộng Cà Phê'), where('Tán Hiên'), where('Lertermer – Hàm Nghi')];
  const said = (offers: Offer[]) => offers.map((o) => (o.kind === 'person' ? o.person.handle : o.place.name));

  it('offers people in the order given, then places, five lines with two held for places', () => {
    expect(said(offersFor('', people, places, []))).toEqual(['trang', 'long96', 'tuananh', 'Cộng Cà Phê', 'Tán Hiên']);
    expect(offersFor('', people, places, [])).toHaveLength(OFFERED);
  });

  it('gives places the lines people do not fill, and people the lines places do not', () => {
    expect(said(offersFor('', people.slice(0, 1), places, []))).toEqual(['trang', 'Cộng Cà Phê', 'Tán Hiên', 'Lertermer – Hàm Nghi']);
    expect(said(offersFor('', people, places.slice(0, 1), []))).toEqual(['trang', 'long96', 'tuananh', 'dang', 'Cộng Cà Phê']);
    expect(said(offersFor('', people, [], []))).toEqual(['trang', 'long96', 'tuananh', 'dang']);
    expect(said(offersFor('', [], [], []))).toEqual([]);
  });

  it('narrows by how a handle, a name, or any word of a name begins — accents and case aside', () => {
    expect(said(offersFor('t', people, places, []))).toEqual(['trang', 'long96', 'tuananh', 'Tán Hiên']);
    expect(said(offersFor('TU', people, places, []))).toEqual(['tuananh']);
    expect(said(offersFor('le', people, places, []))).toEqual(['trang', 'Lertermer – Hàm Nghi']);
    expect(said(offersFor('ca', people, places, []))).toEqual(['Cộng Cà Phê']);
    expect(said(offersFor('ham', people, places, []))).toEqual(['Lertermer – Hàm Nghi']);
    // The middle of a word is not its beginning.
    expect(said(offersFor('ang', people, places, []))).toEqual([]);
  });

  it('offers nothing once the comment holds all the tags the server takes', () => {
    const full = Array.from({ length: TAGS_MAX }, (_, i) => person(i * 3, 2));
    expect(offersFor('', people, places, full)).toEqual([]);
    expect(offersFor('', people, places, full.slice(1))).toHaveLength(OFFERED);
  });
});

describe('tagged', () => {
  const trang: Offer = { kind: 'person', person: who('trang') };
  const cong: Offer = { kind: 'place', place: where('Cộng Cà Phê') };

  it('writes a person as "@" and the handle, a place as "@" and its name', () => {
    expect(wordsOf(trang)).toBe('@trang');
    expect(wordsOf(cong)).toBe('@Cộng Cà Phê');
  });

  it('puts the tag where the "@…" was typed, a space after it, and the caret after the space', () => {
    expect(tagged('hi @tr', [], { at: 3, query: 'tr' }, trang)).toEqual({
      text: 'hi @trang ', tags: [{ at: 3, len: 6, person: 'id-trang', place: null }], caret: 10,
    });
    expect(tagged('@', [], { at: 0, query: '' }, cong)).toEqual({
      text: '@Cộng Cà Phê ', tags: [{ at: 0, len: 12, person: null, place: 'id-Cộng Cà Phê' }], caret: 13,
    });
  });

  it('keeps the words after it, and moves the tags that follow', () => {
    //  0123456789
    // 'at @c with @long96'
    const before = 'at @c with @long96';
    const out = tagged(before, [person(11, 7, 'u-long')], { at: 3, query: 'c' }, cong);
    expect(out.text).toBe('at @Cộng Cà Phê  with @long96');
    expect(out.tags).toEqual([
      { at: 3, len: 12, person: null, place: 'id-Cộng Cà Phê' },
      { at: 22, len: 7, person: 'u-long', place: null },
    ]);
    expect(out.caret).toBe(16);
  });

  it('leaves a tag before it where it was, in reading order', () => {
    const out = tagged('@trang and @c', [person(0, 6)], { at: 11, query: 'c' }, cong);
    expect(out.tags.map((g) => g.at)).toEqual([0, 11]);
  });

  it('counts an emoji in what was typed as one', () => {
    const out = tagged('😀 @tr', [], { at: 2, query: 'tr' }, trang);
    expect(out).toEqual({ text: '😀 @trang ', tags: [{ at: 2, len: 6, person: 'id-trang', place: null }], caret: 9 });
  });
});

describe('outgoing', () => {
  it('sends the words without the space around them, and the tags moved to match', () => {
    expect(outgoing('  \n@trang hi  ', [person(3, 6)])).toEqual({
      body: '@trang hi',
      mentions: [{ at: 0, len: 6, person: 'u1', place: null, handle: null, slug: null }],
    });
    expect(outgoing('at @Cong', [place(3, 5)])).toEqual({
      body: 'at @Cong',
      mentions: [{ at: 3, len: 5, person: null, place: 'p1', handle: null, slug: null }],
    });
  });

  it('sends plain words with no tags', () => {
    expect(outgoing(' hello ', [])).toEqual({ body: 'hello', mentions: [] });
  });

  it('drops a tag that the trimmed words no longer hold', () => {
    // Built by hand: one counted from inside the leading space, one past the end.
    expect(outgoing('  hi', [person(0, 2), person(3, 4)]).mentions).toEqual([]);
    expect(outgoing('hi  ', [person(1, 2)]).mentions).toEqual([]);
    expect(outgoing('hi', [person(0, 2)]).mentions).toHaveLength(1);
  });
});

describe('taggableOf', () => {
  it('reads people and places, keeping a place whole for its name to be read from', () => {
    const cong = { id: 'p1', slug: 'cong', name_en: 'Cong', name_vi: 'Cộng', name_ja: null, i18n: { ja: { name: 'コン' } } };
    expect(taggableOf({
      people: [{ id: 'u1', handle: 'trang', full_name: 'Trang Lê', avatar_url: 'https://f/t.jpg' }, { id: 'u2', handle: 'dang', full_name: null }],
      places: [cong],
    })).toEqual({
      people: [
        { id: 'u1', handle: 'trang', full_name: 'Trang Lê', avatar_url: 'https://f/t.jpg' },
        { id: 'u2', handle: 'dang', full_name: null, avatar_url: null },
      ],
      places: [cong],
      off: false, mine: false,
    });
  });

  it('skips what is not a person or a place', () => {
    expect(taggableOf({
      people: [null, 'x', { id: 'u1' }, { handle: 'trang' }, { id: 7, handle: 'x' }],
      places: [null, { id: 'p1' }, { slug: 'cong' }, { id: 'p1', slug: 9 }],
    })).toEqual({ people: [], places: [], off: false, mine: false });
  });

  it('reads a thread as closed, and as the reader\'s own, only on the word true', () => {
    expect(taggableOf({ people: [], places: [], off: true, mine: true })).toMatchObject({ off: true, mine: true });
    expect(taggableOf({ people: [], places: [], off: true, mine: false })).toMatchObject({ off: true, mine: false });
    expect(taggableOf({ off: 'true', mine: 1 })).toMatchObject({ off: false, mine: false });
  });

  it('is nobody and nowhere for an answer that is not the object', () => {
    for (const raw of [null, undefined, 'x', [], { people: 'x', places: 3 }]) {
      expect(taggableOf(raw)).toEqual({ people: [], places: [], off: false, mine: false });
    }
  });
});

describe('placesNamed', () => {
  const rows = [
    { id: 'p1', slug: 'cong', name_en: 'Cong Cafe', name_vi: 'Cộng Cà Phê', i18n: { ja: { name: 'コンカフェ' } } },
    { id: 'p2', slug: 'nameless', name_en: '', name_vi: ' ', i18n: null },
  ];

  it('names each place in the reader\'s language, and leaves out one with no name at all', () => {
    expect(placesNamed(rows, 'vi')).toEqual([{ id: 'p1', slug: 'cong', name: 'Cộng Cà Phê' }]);
    expect(placesNamed(rows, 'ja')).toEqual([{ id: 'p1', slug: 'cong', name: 'コンカフェ' }]);
    expect(placesNamed(rows, 'en')).toEqual([{ id: 'p1', slug: 'cong', name: 'Cong Cafe' }]);
  });
});
