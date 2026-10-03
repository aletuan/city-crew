// @vitest-environment jsdom
//
// One stop of an evening, as the options card and the saved trip print
// it: the hour, the rail, then the name, its meta line, the model's
// sentence and the journey out. Pinned: the pair of marks that say which
// stop the picture above is on (hour in the accent, name heavier); the
// dash for a stop with no hour; the row for a place the catalog no longer
// lists, which is a gap and not a button; a body that is a button only
// when given somewhere to go; the sentence's language mark, only when it
// is not the reader's; and the rail's first/last, which are `rail`'s.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';
import type { Lang } from '../lib/i18n';

const state = vi.hoisted(() => ({ lang: 'en' as Lang }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: state.lang, setLang: () => {}, t: (en: string, vi: string, ja: string) => ({ en, vi, ja }[state.lang]) }),
}));

import StopRow from './StopRow';

const LEG = { km: 0.8, minutes: 13, mode: 'walk' as const };
const row = (over: Partial<React.ComponentProps<typeof StopRow>> = {}) => render(
  <StopRow time="18:00" name="Hosier Lane" meta="Melbourne City · 75 min" first={false} last={false} {...over} />,
);
const cls = (el: Element) => (el as HTMLElement).className;

describe('StopRow', () => {
  it('prints the hour, the name, the meta line, the sentence and the journey out', () => {
    row({ why: 'Go at six, alone.', leg: LEG });
    expect(screen.getByText('18:00')).toBeTruthy();
    expect(screen.getByText('Hosier Lane')).toBeTruthy();
    expect(screen.getByText('Melbourne City · 75 min')).toBeTruthy();
    expect(screen.getByTestId('stop-why').textContent).toBe('Go at six, alone.');
    expect(screen.getByText('800 m · ≈ 13 min')).toBeTruthy();
  });

  it('leaves out what it was not given: no meta, no sentence, no journey', () => {
    row({ meta: null });
    expect(screen.queryByText('Melbourne City · 75 min')).toBeNull();
    expect(screen.queryByTestId('stop-why')).toBeNull();
    expect(screen.queryByText(/≈/)).toBeNull();
  });

  it('marks the stop the picture is on: the hour in the accent, the name heavier', () => {
    const quiet = row();
    const [time0, name0] = [cls(screen.getByText('18:00')), cls(screen.getByText('Hosier Lane'))];
    quiet.unmount();
    row({ here: true });
    expect(cls(screen.getByText('18:00'))).not.toBe(time0);
    expect(cls(screen.getByText('Hosier Lane'))).not.toBe(name0);
  });

  it('prints a dash for a stop with no hour', () => {
    row({ time: null });
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('is a button only when given somewhere to go, and says where', () => {
    const open = vi.fn();
    row({ onPress: open, pressLabel: 'Open Hosier Lane' });
    fireEvent.click(screen.getByRole('button', { name: 'Open Hosier Lane' }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('is no button without one', () => {
    row();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('draws a delisted stop as a gap, not a button, keeping its sentence', () => {
    row({ name: null, gone: 'No longer listed', why: 'Gone now.', onPress: undefined });
    expect(screen.getByText('No longer listed')).toBeTruthy();
    expect(screen.getByText('Gone now.')).toBeTruthy();
    expect(screen.queryByText('Hosier Lane')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('marks the sentence’s language only when it is not the reader’s', () => {
    row({ why: 'Nước dùng ngon.', whyLang: 'vi' });
    expect(screen.getByText(/· VI/)).toBeTruthy();
    const same = render(<StopRow time="18:00" name="X" first last why="Fine." whyLang="en" />);
    expect(same.container.textContent).not.toMatch(/· EN/);
  });

  it('runs the rail: a paw first, a dot after, a line down to the next', () => {
    row({ first: true, last: false });
    expect(document.querySelectorAll('[data-icon="paw"]')).toHaveLength(1);
    expect(screen.getByTestId('rail-line')).toBeTruthy();
    // The paw's column stands beside the hour, so a test can read them as a pair.
    const paw = document.querySelector('[data-icon="paw"]')!;
    expect(paw.parentElement?.parentElement?.previousElementSibling?.textContent).toBe('18:00');
  });

  it('ends the rail on the last stop', () => {
    row({ first: false, last: true });
    expect(screen.getByTestId('rail-dot')).toBeTruthy();
    expect(screen.queryByTestId('rail-line')).toBeNull();
  });

  it('keeps the name to one line when asked, as the options card does', () => {
    row({ nameLines: 1 });
    // react-native-web renders numberOfLines={1} as a clamp class, which is all this environment shows.
    const quiet = cls(screen.getByText('Hosier Lane'));
    expect(quiet).not.toBe(cls(render(<StopRow time="18:00" name="Hosier Lane" first last />).getAllByText('Hosier Lane')[1]));
  });
});
