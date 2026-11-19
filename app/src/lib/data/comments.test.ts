// The four calls, asserted for which function each is and what it is
// handed: a subject becomes `p_collection`, a comment that answers
// nobody sends a null parent, a tag crosses as where it is and what it
// points at. And for what comes back: nulls kept, tags read, a refusal
// thrown under the server's own word so `refusalOf` can name it.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('../testing').fakeSupabase> | null }));
vi.mock('../supabase', async () => {
  const { fakeSupabase } = await import('../testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});
const fake = () => h.fake!;

import { deleteComment, fetchCommentNews, fetchPreviews, fetchTaggable, fetchThread, likeComment, postComment, setCommentsOff } from './comments';
import { refusalOf, type Subject } from '../comments';

const list = (id: string): Subject => ({ kind: 'collection', id });

beforeEach(() => fake().reset());

describe('fetchThread', () => {
  it('asks the function for this subject, newest first unless told otherwise', async () => {
    fake().replies({ data: [] });
    expect(await fetchThread(list('c1'))).toEqual([]);
    expect(fake().log).toEqual([
      { op: 'rpc', fn: 'comment_thread', payload: { p_collection: 'c1', p_order: 'new' }, filters: [] },
    ]);
  });

  it('hands back each row as it came, nulls and all, with its tags read', async () => {
    const wire = {
      id: 'k1', parent_id: null, root_id: null, depth: 0, body: 'Hi @trang', created_at: 'x',
      author: 'u1', handle: 'long', full_name: null, avatar_url: null,
      mentions: [{ at: 3, len: 6, person: 'u2', handle: 'trang', place: null, slug: null }, { at: 'bad' }],
    };
    const nameless = { ...wire, id: 'k2', parent_id: 'k1', root_id: 'k1', depth: 1, handle: null, mentions: [] };
    fake().replies({ data: [wire, nameless] });
    const [a, b] = await fetchThread(list('c1'));
    // A server from before the hearts sends neither column: none, and not the reader's.
    expect(a).toEqual({ ...wire, mentions: [{ at: 3, len: 6, person: 'u2', handle: 'trang', place: null, slug: null }], likes: 0, liked: false });
    expect(b).toEqual({ ...nameless, likes: 0, liked: false });
  });

  it('reads the hearts as it reads the tags: a figure that is one, and only true is the reader\'s', async () => {
    const wire = {
      id: 'k1', parent_id: null, root_id: null, depth: 0, body: 'Hi', created_at: 'x',
      author: 'u1', handle: 'long', full_name: null, avatar_url: null, mentions: [],
    };
    fake().replies({ data: [
      { ...wire, likes: 3, liked: true },
      { ...wire, id: 'k2', likes: '3', liked: 'yes' },
      { ...wire, id: 'k3', likes: null, liked: null },
      { ...wire, id: 'k4', likes: 1, liked: false },
    ] });
    const out = await fetchThread(list('c1'));
    expect(out.map((c) => [c.likes, c.liked])).toEqual([[3, true], [0, false], [0, false], [1, false]]);
  });

  it('is an empty thread for a null answer', async () => {
    fake().replies({ data: null });
    expect(await fetchThread(list('c1'))).toEqual([]);
  });

  it('throws what the server said', async () => {
    fake().replies({ error: { message: 'timeout' } });
    await expect(fetchThread(list('c1'))).rejects.toThrow('timeout');
  });
});

describe('fetchPreviews', () => {
  it('asks once for the whole batch and files the answer by subject', async () => {
    fake().replies({ data: [
      { collection_id: 'c2', n: 3, latest: [{ id: 'k9', body: 'newest' }, { id: 'k8', body: 'next' }] },
    ] });
    const out = await fetchPreviews([list('c1'), list('c2')]);
    expect(fake().log).toEqual([
      { op: 'rpc', fn: 'comment_previews', payload: { p_collections: ['c1', 'c2'] }, filters: [] },
    ]);
    // c1 has no comments: it is not in the answer, and that is "none".
    expect(Object.keys(out)).toEqual(['c2']);
    expect(out.c2.n).toBe(3);
    expect(out.c2.latest.map((c) => c.body)).toEqual(['newest', 'next']);
    // And open: a server that says nothing of `off` is one from before a thread could be closed.
    expect(out.c2.off).toBe(false);
  });

  it('reads a thread as closed only on the word true, with comments or with none', async () => {
    fake().replies({ data: [
      { collection_id: 'c1', n: 0, latest: [], off: true },
      { collection_id: 'c2', n: 2, latest: [], off: false },
      { collection_id: 'c3', n: 1, latest: [], off: 'true' },
    ] });
    const out = await fetchPreviews([list('c1'), list('c2'), list('c3')]);
    expect(out.c1).toEqual({ n: 0, latest: [], off: true });
    expect([out.c2.off, out.c3.off]).toEqual([false, false]);
  });

  it('says nothing to the network for an empty batch', async () => {
    expect(await fetchPreviews([])).toEqual({});
    expect(fake().log).toHaveLength(0);
  });

  it('is no previews for a null answer', async () => {
    fake().replies({ data: null });
    expect(await fetchPreviews([list('c1')])).toEqual({});
  });

  it('throws what the server said', async () => {
    fake().replies({ error: { message: 'timeout' } });
    await expect(fetchPreviews([list('c1')])).rejects.toThrow('timeout');
  });
});

describe('postComment', () => {
  it('posts a comment that answers nobody, with no tags, and hands back its id', async () => {
    fake().replies({ data: 'k-new' });
    expect(await postComment(list('c1'), null, 'hello')).toBe('k-new');
    expect(fake().log).toEqual([{
      op: 'rpc', fn: 'post_comment', filters: [],
      payload: { p_collection: 'c1', p_parent: null, p_body: 'hello', p_mentions: [] },
    }]);
  });

  it('sends an answer under its parent, and each tag as where it is and what it points at', async () => {
    fake().replies({ data: 'k-new' });
    await postComment(list('c1'), 'k1', 'Hi @trang at Cafe', [
      { at: 3, len: 6, person: 'u2', handle: 'trang', place: null, slug: null },
      { at: 13, len: 4, person: null, handle: null, place: 'p1', slug: null },
    ]);
    expect(fake().log[0].payload).toEqual({
      p_collection: 'c1', p_parent: 'k1', p_body: 'Hi @trang at Cafe',
      // No handle, and no key for the target it is not.
      p_mentions: [{ at: 3, len: 6, person: 'u2' }, { at: 13, len: 4, place: 'p1' }],
    });
  });

  it('throws a refusal under the server\'s word for it, and a failure as it came', async () => {
    fake().replies({ error: { message: 'comment:cap' } });
    const refused = await postComment(list('c1'), null, 'hello').catch((e: unknown) => e);
    expect(refusalOf(refused)).toBe('cap');

    fake().replies({ error: { message: 'Failed to fetch' } });
    const failed = await postComment(list('c1'), null, 'hello').catch((e: unknown) => e);
    expect(failed).toBeInstanceOf(Error);
    expect(refusalOf(failed)).toBeNull();
  });
});

describe('deleteComment', () => {
  it('asks the function to take this one back', async () => {
    await deleteComment('k1');
    expect(fake().log).toEqual([{ op: 'rpc', fn: 'delete_comment', payload: { p_id: 'k1' }, filters: [] }]);
  });

  it('throws a refusal so it can be named', async () => {
    fake().replies({ error: { message: 'comment:not_yours' } });
    expect(refusalOf(await deleteComment('k1').catch((e: unknown) => e))).toBe('not_yours');
  });
});

describe('likeComment', () => {
  it('asks the function to set the reader\'s heart, or to take it back', async () => {
    await likeComment('k1', true);
    await likeComment('k1', false);
    expect(fake().log).toEqual([
      { op: 'rpc', fn: 'like_comment', payload: { p_id: 'k1', p_on: true }, filters: [] },
      { op: 'rpc', fn: 'like_comment', payload: { p_id: 'k1', p_on: false }, filters: [] },
    ]);
  });

  it('throws what the server said', async () => {
    fake().replies({ error: { message: 'comment:parent' } });
    await expect(likeComment('k1', true)).rejects.toThrow('comment:parent');
  });
});

describe('fetchTaggable', () => {
  it('asks by the subject, and reads the answer as people and places', async () => {
    fake().replies({ data: {
      people: [{ id: 'u1', handle: 'trang', full_name: null, avatar_url: null }, { id: 'bad' }],
      places: [{ id: 'p1', slug: 'cong', name_en: 'Cong', name_vi: 'Cộng' }],
    } });
    expect(await fetchTaggable(list('c1'))).toEqual({
      people: [{ id: 'u1', handle: 'trang', full_name: null, avatar_url: null }],
      places: [{ id: 'p1', slug: 'cong', name_en: 'Cong', name_vi: 'Cộng' }],
      off: false, mine: false,
    });
    expect(fake().log).toEqual([{ op: 'rpc', fn: 'comment_taggable', payload: { p_collection: 'c1' }, filters: [] }]);
  });

  it('throws what the server said', async () => {
    fake().replies({ error: { message: 'down' } });
    await expect(fetchTaggable(list('c1'))).rejects.toThrow('down');
  });
});

describe('setCommentsOff', () => {
  it('writes the switch, and nothing else, to the subject\'s own row', async () => {
    fake().replies({ data: [{ id: 'c1' }] });
    await setCommentsOff(list('c1'), true);
    fake().replies({ data: [{ id: 'c1' }] });
    await setCommentsOff(list('c1'), false);
    expect(fake().log.map((l) => [l.op, l.payload, l.filters])).toEqual([
      ['update', { comments_off: true }, [['id', 'c1']]],
      ['update', { comments_off: false }, [['id', 'c1']]],
    ]);
  });

  it('throws when the write changed no row: somebody else\'s list', async () => {
    fake().replies({ data: [] });
    await expect(setCommentsOff(list('c1'), true)).rejects.toThrow('comment:subject');
    fake().replies({ data: null });
    await expect(setCommentsOff(list('c1'), true)).rejects.toThrow('comment:subject');
  });

  it('throws what the server said', async () => {
    fake().replies({ error: { message: 'down' } });
    await expect(setCommentsOff(list('c1'), true)).rejects.toThrow('down');
  });
});

describe('fetchCommentNews', () => {
  it('asks for the news since an instant, and reads the rows', async () => {
    fake().replies({ data: [
      { kind: 'reply', comment_id: 'k1', list: { id: 'c1', slug: 's' }, handle: 'trang', body: 'hi', at: '2026-11-18T10:00:00Z', others: 0 },
      { kind: 'unknown', comment_id: 'k2', list: { id: 'c1' }, at: 'x' },
    ] });
    const out = await fetchCommentNews('2026-11-05T00:00:00Z');
    expect(out.map((n) => [n.kind, n.comment_id, n.handle])).toEqual([['reply', 'k1', 'trang']]);
    expect(fake().log).toEqual([{ op: 'rpc', fn: 'comment_news', payload: { p_since: '2026-11-05T00:00:00Z' }, filters: [] }]);
  });

  it('throws what the server said', async () => {
    fake().replies({ error: { message: 'down' } });
    await expect(fetchCommentNews('x')).rejects.toThrow('down');
  });
});
