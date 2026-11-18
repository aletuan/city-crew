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

import { deleteComment, fetchPreviews, fetchThread, postComment } from './comments';
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
      mentions: [{ at: 3, len: 6, person: 'u2', handle: 'trang', place: null }, { at: 'bad' }],
    };
    const nameless = { ...wire, id: 'k2', parent_id: 'k1', root_id: 'k1', depth: 1, handle: null, mentions: [] };
    fake().replies({ data: [wire, nameless] });
    const [a, b] = await fetchThread(list('c1'));
    expect(a).toEqual({ ...wire, mentions: [{ at: 3, len: 6, person: 'u2', handle: 'trang', place: null }] });
    expect(b).toEqual(nameless);
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
      { at: 3, len: 6, person: 'u2', handle: 'trang', place: null },
      { at: 13, len: 4, person: null, handle: null, place: 'p1' },
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
