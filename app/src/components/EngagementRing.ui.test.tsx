// @vitest-environment jsdom
//
// The ring around the profile avatar, and what it says.
//
// The arithmetic of the sweep is `lib/ring` and `lib/level`, both pure
// and both at 100%. What the component adds — and what nothing had
// rendered until now, because `ProfileScreen`'s test stands the ring in
// with a stub — is the reading: how many segments are drawn for a given
// progress, that a full ring is never drawn, that a new account gets an
// arc and not a bare track, and which grey the headroom wears under
// each theme.
//
// `react-native-svg` is stubbed in `setup.tsx` as pass-through elements
// that keep their tag and their props, which is exactly enough: a `Path`
// per segment and a `Circle` for the track, each with its stroke.

import React from 'react';
import { Text } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, viewStyleOf } from '../uitest/render';
import { ringTrack } from '../theme';
import { visibleSweep } from '../lib/ring';

// The scheme is the one thing the ring reads from outside its props, and
// the real provider decides it from the phone and a stored preference —
// neither of which a test should have to arrange to see a grey change.
const theme = vi.hoisted(() => ({ scheme: 'dark' as 'dark' | 'light' }));
vi.mock('../lib/theme', () => ({ useScheme: () => ({ scheme: theme.scheme }) }));

import EngagementRing from './EngagementRing';

const paths = (root: HTMLElement) => root.querySelectorAll('[data-stub="Path"]');
const track = (root: HTMLElement) => root.querySelector('[data-stub="Circle"]');

const explain = vi.fn();
const ring = (progress: number, level = 3) =>
  render(
    <EngagementRing size={88} level={level} progress={progress} onExplain={explain}>
      <Text>face</Text>
    </EngagementRing>,
  );

describe('the engagement ring', () => {
  beforeEach(() => { theme.scheme = 'dark'; explain.mockClear(); });

  // Something new behind the pill (17 Nov 2026): a badge earned since
  // its sheet was last closed.
  it('wears a dot on the pill only when told something behind it is new', () => {
    const quiet = ring(0.4);
    expect(screen.queryByTestId('level-fresh')).toBeNull();
    quiet.unmount();
    render(
      <EngagementRing size={88} level={3} progress={0.4} fresh onExplain={explain}>
        <Text>face</Text>
      </EngagementRing>,
    );
    const dot = screen.getByTestId('level-fresh');
    // On the pill, so a press on the dot is a press on the pill.
    expect(screen.getByTestId('level-badge').contains(dot)).toBe(true);
    fireEvent.click(dot);
    expect(explain).toHaveBeenCalledOnce();
    // The pill still reads as the level and nothing more.
    expect(screen.getByTestId('level-badge').textContent).toBe('Lv 3');
    // On its corner, laid over it.
    expect(viewStyleOf(dot).position).toBe('absolute');
  });

  // The pill says what the level is, when pressed (owner, 16 Nov 2026):
  // nothing in the app said what it counted.
  it('makes the pill a press that asks for the explanation, and nothing else one', () => {
    const { container } = ring(0.4, 15);
    const pill = screen.getByTestId('level-badge');
    expect(pill.textContent).toBe('Lv 15');
    expect(pill.getAttribute('role')).toBe('button');
    // Spelled for VoiceOver, which reads "Lv" as two letters.
    expect(pill.getAttribute('aria-label')).toBe('Level 15');
    // Pressing the picture or the ring is not pressing the pill.
    fireEvent.click(screen.getByText('face'));
    fireEvent.click(track(container)!);
    expect(explain).not.toHaveBeenCalled();
    fireEvent.click(pill);
    expect(explain).toHaveBeenCalledOnce();
  });

  it('wraps the avatar it is given and names the level on its corner', () => {
    ring(0.4, 7);
    expect(screen.getByText('face')).toBeTruthy();
    expect(screen.getByText('Lv 7')).toBeTruthy();
  });

  it('draws one segment per step of the sweep the progress earns', () => {
    const { container } = ring(0.5);
    expect(paths(container)).toHaveLength(visibleSweep(0.5).length);
    // More progress, more segments: the arc is a reading, not a mark.
    expect(visibleSweep(0.5).length).toBeGreaterThan(visibleSweep(0.2).length);
  });

  // The floor: a brand-new account still gets an arc, because a bare
  // track with a scratch on it is not a reading anybody can take.
  it('gives a new account an arc rather than a bare track', () => {
    const { container } = ring(0);
    expect(paths(container).length).toBeGreaterThan(0);
    expect(paths(container)).toHaveLength(visibleSweep(0).length);
  });

  // The ceiling: a progress of 1 would close the ring and announce
  // "level complete" on an account that has just levelled up.
  it('never closes the ring, whatever progress is claimed', () => {
    // The geometry, from the component's own figures: a 88pt avatar in
    // a 103pt box, so the track's top — twelve o'clock, where a closed
    // ring would end — is (51.5, 2). Sixty segments are drawn either
    // way; what the clamp changes is where the last one stops. Measured
    // as a distance, not as text: a ring that did close would end a
    // floating-point hair from the top, and a string compare would call
    // that hair a gap.
    const end = (root: HTMLElement) => {
      const all = paths(root);
      const [x, y] = all[all.length - 1].getAttribute('d')!.split(' ').slice(-2).map(Number);
      return { x, y };
    };
    const gapToTop = ({ x, y }: { x: number; y: number }) => Math.hypot(x - 51.5, y - 2);
    const { container: atOne, unmount } = ring(1);
    expect(paths(atOne)).toHaveLength(visibleSweep(0.999).length);
    const endAtOne = end(atOne);
    // 0.36° short of a turn on a 49.5pt radius is about a third of a point.
    expect(gapToTop(endAtOne)).toBeGreaterThan(0.1);
    unmount();
    // Past one is the same as one: clamped, not trusted.
    const { container: past } = ring(1.5);
    expect(end(past)).toEqual(endAtOne);
  });

  it('draws each segment as a round-capped arc from the twelve o’clock start', () => {
    const { container } = ring(0.3);
    const first = paths(container)[0];
    expect(first.getAttribute('strokeLinecap') ?? first.getAttribute('stroke-linecap')).toBe('round');
    // An arc command, not a line: `A r r 0 0 1` sweeps clockwise.
    expect(first.getAttribute('d')).toMatch(/^M [\d.]+ [\d.]+ A [\d.]+ [\d.]+ 0 0 1 [\d.]+ [\d.]+$/);
  });

  // Both halves have to be visible, and the headroom's grey is the one
  // token that cannot be a dynamic pair — see `ringTrack` — so it is
  // read from the scheme here, and each scheme gets its own.
  it('wears each scheme’s own track grey', () => {
    const { container: dark, unmount } = ring(0.5);
    expect(track(dark)?.getAttribute('stroke')).toBe(ringTrack.dark);
    unmount();

    theme.scheme = 'light';
    const { container: light } = ring(0.5);
    expect(track(light)?.getAttribute('stroke')).toBe(ringTrack.light);
  });
});
