// The shape of a thread, proved without a screen: what sits under what
// and how far in, where a tag begins when the body has an emoji in it, and which
// of the server's refusals is which.

import { describe, expect, it } from 'vitest';
import {
  BODY_MAX, LEVEL_MAX, MENTIONS_MAX, REFUSALS,
  bodyLength, bodyProblem, latestOf, mentionsOf, refusalOf, segmentsOf, threadOf,
  type CommentRow, type Mention,
} from './comments';

/** A row, with only what a case is about spelled out. */
function row(id: string, parent: string | null, over: Partial<CommentRow> = {}): CommentRow {
  return {
    id, parent_id: parent, root_id: null, depth: 0, body: `body of ${id}`, created_at: `2026-11-0${id.length}T00:00:00Z`,
    author: `u-${id}`, handle: `h-${id}`, full_name: null, avatar_url: null, mentions: [],
    ...over,
  };
}
/** `id@level` for each row drawn, `>handle` appended where it names who it answers. */
const drawn = (rows: CommentRow[]) => threadOf(rows).map((b) => [b.root, ...b.replies]
  .map((p) => `${p.id}@${p.level}${p.to ? `>${p.to}` : ''}`).join(' '));

describe('the server\'s numbers', () => {
  it('are the ones the migration enforces', () => {
    expect([BODY_MAX, MENTIONS_MAX, LEVEL_MAX]).toEqual([500, 10, 2]);
  });
});

describe('bodyLength', () => {
  it('counts characters as Postgres does, not UTF-16 units', () => {
    expect(bodyLength('phở')).toBe(3);
    expect('🍜'.length).toBe(2);
    expect(bodyLength('🍜 ngon')).toBe(6);
  });
});

describe('bodyProblem', () => {
  it('is none for words, "empty" for spaces alone, and "long" past the ceiling', () => {
    expect(bodyProblem('  hello  ')).toBeNull();
    expect(bodyProblem('')).toBe('empty');
    expect(bodyProblem(' \n\t ')).toBe('empty');
    expect(bodyProblem('é'.repeat(BODY_MAX))).toBeNull();
    expect(bodyProblem('é'.repeat(BODY_MAX + 1))).toBe('long');
  });

  it('counts after trimming, and in characters: 500 emoji and a space on each side still fit', () => {
    expect(bodyProblem(` ${'🍜'.repeat(BODY_MAX)} `)).toBeNull();
    expect(bodyProblem('🍜'.repeat(BODY_MAX + 1))).toBe('long');
  });
});

describe('threadOf', () => {
  it('keeps the roots in the order they came, each with its answers after it', () => {
    const rows = [
      row('b', null, { created_at: '2026-11-02' }),
      row('a', null, { created_at: '2026-11-01' }),
      row('a1', 'a', { depth: 1, created_at: '2026-11-03' }),
      row('b1', 'b', { depth: 1, created_at: '2026-11-04' }),
    ];
    expect(drawn(rows)).toEqual(['b@0 b1@1', 'a@0 a1@1']);
  });

  it('draws three levels, and puts what is under an answer right after that answer', () => {
    // a ─ a1 ─ a1x          (a1x answers a1)
    //   └ a2                (written between them)
    const rows = [
      row('a', null),
      row('a1', 'a', { depth: 1, created_at: '2026-11-01' }),
      row('a2', 'a', { depth: 1, created_at: '2026-11-02' }),
      row('a1x', 'a1', { depth: 2, created_at: '2026-11-03' }),
    ];
    // By time alone a1x would fall after a2, answering the wrong comment to the eye.
    expect(drawn(rows)).toEqual(['a@0 a1@1 a1x@2 a2@1']);
  });

  it('holds anything deeper on the last level, oldest first, naming who it answers', () => {
    // a ─ a1 ─ p ─ q ─ r     and a second answer to a1, s, written between q and r
    const rows = [
      row('a', null),
      row('a1', 'a', { depth: 1 }),
      row('p', 'a1', { depth: 2, created_at: '2026-11-01' }),
      row('q', 'p', { depth: 3, created_at: '2026-11-02' }),
      row('r', 'q', { depth: 4, created_at: '2026-11-04' }),
      row('s', 'a1', { depth: 2, created_at: '2026-11-03' }),
    ];
    // p and s answer a1, which the indent says; q and r say whom.
    expect(drawn(rows)).toEqual(['a@0 a1@1 p@2 q@2>h-p s@2 r@2>h-q']);
  });

  it('keeps the order they came in for two written at the same instant', () => {
    const rows = [
      row('a', null), row('a1', 'a', { depth: 1 }),
      row('y', 'a1', { depth: 2, created_at: 'same' }), row('x', 'a1', { depth: 2, created_at: 'same' }),
    ];
    expect(drawn(rows)).toEqual(['a@0 a1@1 y@2 x@2']);
  });

  it('names nobody for a deep answer whose writer has no handle', () => {
    const rows = [
      row('a', null), row('a1', 'a', { depth: 1 }),
      row('p', 'a1', { depth: 2, handle: null }), row('q', 'p', { depth: 3 }),
    ];
    expect(threadOf(rows)[0].replies[2]).toMatchObject({ id: 'q', to: null });
  });

  // A thread read while something in it was being deleted.
  it('drops an answer whose parent did not arrive, and what was said under it', () => {
    expect(drawn([row('a', null), row('lost', 'nowhere', { depth: 1 }), row('lost2', 'lost', { depth: 2 })])).toEqual(['a@0']);
  });

  it('is nothing for nothing', () => {
    expect(threadOf([])).toEqual([]);
  });

  it('leaves the rows it was given as they were', () => {
    const rows = [row('a', null), row('a1', 'a', { depth: 1 })];
    const before = JSON.stringify(rows);
    threadOf(rows);
    expect(JSON.stringify(rows)).toBe(before);
  });
});

describe('mentionsOf', () => {
  it('reads a person and a place, and a handle only where there is one', () => {
    expect(mentionsOf([
      { at: 0, len: 6, person: 'u1', handle: 'trang', place: null },
      { at: 8, len: 4, person: null, handle: null, place: 'p1' },
      { at: 14, len: 2, person: 'u2' },
    ])).toEqual([
      { at: 0, len: 6, person: 'u1', handle: 'trang', place: null },
      { at: 8, len: 4, person: null, handle: null, place: 'p1' },
      { at: 14, len: 2, person: 'u2', handle: null, place: null },
    ]);
  });

  it('drops what is not a tag: no offsets, no target, two targets, not an object', () => {
    expect(mentionsOf([
      null, 'x', { at: '0', len: 1, person: 'u' }, { at: 0, len: '1', person: 'u' },
      { at: 0, len: 1 }, { at: 0, len: 1, person: 'u', place: 'p' },
    ])).toEqual([]);
  });

  it('is no tags for anything that is not a list', () => {
    expect(mentionsOf(null)).toEqual([]);
    expect(mentionsOf({ at: 0 })).toEqual([]);
    expect(mentionsOf('[]')).toEqual([]);
  });
});

describe('segmentsOf', () => {
  const person = (at: number, len: number): Mention => ({ at, len, person: 'u1', handle: 'trang', place: null });
  const place = (at: number, len: number): Mention => ({ at, len, person: null, handle: null, place: 'p1' });

  it('is the whole body when there are no tags, and nothing for an empty one', () => {
    expect(segmentsOf('just words', [])).toEqual([{ kind: 'text', text: 'just words' }]);
    expect(segmentsOf('', [])).toEqual([]);
  });

  it('cuts words, a person and a place in reading order, whatever order the tags came in', () => {
    expect(segmentsOf('Hi @trang at Cafe!', [place(13, 4), person(3, 6)])).toEqual([
      { kind: 'text', text: 'Hi ' },
      { kind: 'person', text: '@trang', id: 'u1', handle: 'trang' },
      { kind: 'text', text: ' at ' },
      { kind: 'place', text: 'Cafe', id: 'p1' },
      { kind: 'text', text: '!' },
    ]);
  });

  it('puts no empty words before a tag at the start, between two that touch, or after one at the end', () => {
    expect(segmentsOf('@trangCafe', [person(0, 6), place(6, 4)]).map((s) => s.kind)).toEqual(['person', 'place']);
  });

  it('counts in characters, so an emoji before a tag does not shift it', () => {
    // "🍜 @trang": the @ is the third character and the fourth UTF-16 unit.
    expect(segmentsOf('🍜 @trang ơi', [person(2, 6)])).toEqual([
      { kind: 'text', text: '🍜 ' },
      { kind: 'person', text: '@trang', id: 'u1', handle: 'trang' },
      { kind: 'text', text: ' ơi' },
    ]);
  });

  it('leaves as words a tag that runs past the end, has no length, or starts inside the one before', () => {
    expect(segmentsOf('abcdef', [person(4, 3)])).toEqual([{ kind: 'text', text: 'abcdef' }]);
    expect(segmentsOf('abcdef', [person(2, 0)])).toEqual([{ kind: 'text', text: 'abcdef' }]);
    expect(segmentsOf('abcdef', [person(0, 4), place(2, 2)])).toEqual([
      { kind: 'person', text: 'abcd', id: 'u1', handle: 'trang' },
      { kind: 'text', text: 'ef' },
    ]);
    // Exactly to the end is in bounds.
    expect(segmentsOf('abcdef', [place(4, 2)]).map((s) => s.kind)).toEqual(['text', 'place']);
  });

  it('draws a tag that points at nothing as the words it covers', () => {
    expect(segmentsOf('abc', [{ at: 1, len: 1, person: null, handle: null, place: null }])).toEqual([
      { kind: 'text', text: 'a' }, { kind: 'text', text: 'b' }, { kind: 'text', text: 'c' },
    ]);
  });
});

describe('refusalOf', () => {
  it('names each refusal the server raises', () => {
    for (const word of REFUSALS) expect(refusalOf(new Error(`comment:${word}`))).toBe(word);
    expect(REFUSALS).toHaveLength(10);
  });

  it('is null for a failure that is not the rules working', () => {
    expect(refusalOf(new Error('Failed to fetch'))).toBeNull();
    // `comment:order` is raised by a read and is a bug in the caller, not something to tell a reader.
    expect(refusalOf(new Error('comment:order'))).toBeNull();
    expect(refusalOf(new Error('a comment:cap elsewhere'))).toBeNull();
    expect(refusalOf('comment:cap')).toBeNull();
    expect(refusalOf(null)).toBeNull();
  });
});

describe('latestOf', () => {
  it('reads the comments a card previews, nulls where the wire had none', () => {
    expect(latestOf([
      { id: 'c1', body: 'hello', created_at: 'x', author: 'u1', handle: 'trang', full_name: 'Trang', avatar_url: 'a.jpg' },
      { id: 'c2', body: 'again' },
    ])).toEqual([
      { id: 'c1', body: 'hello', created_at: 'x', author: 'u1', handle: 'trang', full_name: 'Trang', avatar_url: 'a.jpg' },
      { id: 'c2', body: 'again', created_at: '', author: null, handle: null, full_name: null, avatar_url: null },
    ]);
  });

  it('drops what has no id or no body, and is nothing for what is not a list', () => {
    expect(latestOf([null, { id: 'c1' }, { body: 'x' }, { id: 1, body: 'x' }])).toEqual([]);
    expect(latestOf(null)).toEqual([]);
    expect(latestOf({})).toEqual([]);
  });
});
