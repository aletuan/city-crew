// @vitest-environment jsdom
//
// Comments on or off as a row in your own list's ⋯ menu — see
// `CommentsSetting`. The sheet it opens is the thread's own, tested with
// it (`useThreadOwner`).
import React from 'react';
import { Text } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../uitest/render';

const state = vi.hoisted(() => ({ flag: true, off: undefined as boolean | undefined, asked: [] as string[][] }));
vi.mock('../../lib/useFlag', () => ({ useFlag: () => state.flag }));
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ lang: 'en', t: (en: string) => en }) }));
vi.mock('../../lib/data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  usePreviewsQuery: (ids: string[]) => {
    state.asked.push(ids);
    return { data: state.off === undefined ? {} : { c1: { n: 0, latest: [], off: state.off } }, loading: false, loaded: true, reload: () => {} };
  },
}));
vi.mock('../comments/useThreadOwner', () => ({ useThreadOwner: () => ({ show: () => {}, node: null }) }));

import { useCommentsSetting } from './CommentsSetting';

function Probe(props: { list: { id?: string | null; is_public?: boolean | null } | null; owned: boolean }) {
  const { row } = useCommentsSetting(props.list, props.owned);
  return <Text testID="row">{row ? `${row.title}|${row.desc}|${row.icon}` : 'none'}</Text>;
}
const row = () => screen.getByTestId('row').textContent;

afterEach(() => { state.flag = true; state.off = undefined; state.asked = []; });

describe('useCommentsSetting', () => {
  it('says where the thread stands, and reads it as open until told', () => {
    const { rerender } = render(<Probe list={{ id: 'c1', is_public: true }} owned />);
    expect(row()).toBe('Comments|On|chatbubble-outline');
    state.off = true;
    rerender(<Probe list={{ id: 'c1', is_public: true }} owned />);
    expect(row()).toBe('Comments|Off|close-circle-outline');
    state.off = false;
    rerender(<Probe list={{ id: 'c1', is_public: true }} owned />);
    expect(row()).toBe('Comments|On|chatbubble-outline');
  });

  it('is no row, and asks nothing, where no thread can be', () => {
    for (const [list, owned, flag] of [
      [{ id: 'c1', is_public: false }, true, true],
      [{ id: 'c1', is_public: true }, false, true],
      [{ id: 'c1', is_public: true }, true, false],
      [{ id: null, is_public: true }, true, true],
      [null, true, true],
    ] as const) {
      state.flag = flag; state.asked = [];
      const { unmount } = render(<Probe list={list} owned={owned} />);
      expect(row()).toBe('none');
      expect(state.asked.every((ids) => ids.length === 0)).toBe(true);
      unmount();
    }
  });
});
