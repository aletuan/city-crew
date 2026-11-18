// @vitest-environment jsdom
//
// The way into a list's comments: drawn only with the `comments` switch
// on, on a public list that has an id — and then it hands back that id.

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '../../uitest/render';
import { appFlags } from '../../lib/flags';

vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ lang: 'vi', t: (_en: string, vi: string) => vi }) }));

import { CommentsDoor } from './CommentsDoor';

const onPress = vi.fn();
const show = (list: Parameters<typeof CommentsDoor>[0]['list']) => render(<CommentsDoor list={list} onPress={onPress} />);
const door = () => screen.queryByTestId('collection-comments');

afterEach(() => { cleanup(); appFlags.reset(); vi.clearAllMocks(); });

describe('CommentsDoor', () => {
  it('is nothing while the switch is off, which is how it ships', () => {
    show({ id: 'c1', is_public: true });
    expect(door()).toBeNull();
  });

  it('opens the list\'s thread with the switch on, and names itself for VoiceOver', () => {
    appFlags.set('comments', true);
    show({ id: 'c1', is_public: true });
    expect(door()!.getAttribute('aria-label')).toBe('Bình luận');
    fireEvent.click(door()!);
    expect(onPress).toHaveBeenCalledWith('c1');
  });

  it('is nothing on a list that is not public, has no id, or is not there', () => {
    appFlags.set('comments', true);
    for (const list of [{ id: 'c1', is_public: false }, { id: null, is_public: true }, { is_public: true }, null, undefined]) {
      show(list);
      expect(door()).toBeNull();
      cleanup();
    }
  });

  it('appears when the switch is turned on under it, without a new render from above', () => {
    show({ id: 'c1', is_public: true });
    expect(door()).toBeNull();
    act(() => { appFlags.set('comments', true); });
    expect(door()).not.toBeNull();
  });
});
