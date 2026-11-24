// @vitest-environment jsdom
//
// The one line said from the foot of the screen: said, replaced, put
// away — and said to nobody where no provider stands.

import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '../uitest/render';
import { NoticeProvider, useNotice } from './notice';

let hold: ReturnType<typeof useNotice>;
function Probe() {
  const n = useNotice();
  // Handed out after the render, not during it.
  useEffect(() => { hold = n; });
  return <Text testID="said">{n.note ? `${n.note.id}:${n.note.text}:${n.note.action}` : 'none'}</Text>;
}
const said = () => screen.getByTestId('said').textContent;

afterEach(cleanup);

describe('NoticeProvider', () => {
  it('holds nothing until something is said, then that line', () => {
    render(<NoticeProvider><Probe /></NoticeProvider>);
    expect(said()).toBe('none');
    act(() => hold.say({ text: 'Added to your page', action: 'View' }));
    expect(said()).toBe('1:Added to your page:View');
  });

  it('gives the same words said again a new id, and lets a second line take the first’s place', () => {
    render(<NoticeProvider><Probe /></NoticeProvider>);
    act(() => hold.say({ text: 'A', action: 'View' }));
    act(() => hold.say({ text: 'A', action: 'View' }));
    expect(said()).toBe('2:A:View');
    act(() => hold.say({ text: 'B', action: 'Open' }));
    expect(said()).toBe('3:B:Open');
  });

  it('puts the line away', () => {
    render(<NoticeProvider><Probe /></NoticeProvider>);
    act(() => hold.say({ text: 'A', action: 'View' }));
    act(() => hold.dismiss());
    expect(said()).toBe('none');
  });

  it('keeps `say` and `dismiss` the same functions across lines, so an effect that holds them does not re-run', () => {
    render(<NoticeProvider><Probe /></NoticeProvider>);
    const { say, dismiss } = hold;
    act(() => hold.say({ text: 'A', action: 'View' }));
    expect(hold.say).toBe(say);
    expect(hold.dismiss).toBe(dismiss);
  });

  it('says a line to nobody outside the provider, and breaks nothing', () => {
    render(<Probe />);
    act(() => { hold.say({ text: 'A', action: 'View' }); hold.dismiss(); });
    expect(said()).toBe('none');
  });
});
