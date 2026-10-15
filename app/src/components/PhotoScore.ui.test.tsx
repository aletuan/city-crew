// @vitest-environment jsdom
//
// The four drawings of a photo's score. What is pinned is what the guide
// reads — the number and how it is written, the word, the reasons, how
// far a run has got, and the ways out — not the arithmetic, which is
// `lib/photoScore`'s and tested there.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AccessibilityInfo, Animated } from 'react-native';
import { act, fireEvent, render, screen } from '../uitest/render';
import { SCORER_VERSION, type PhotoScore } from '../lib/photoScore';

// Every loop started, and every one stopped. Under jsdom no frame of a
// native-driven animation is drawn, so whether the bars are moving is
// read off the loops: started when they should move, stopped when they
// should not.
const realLoop = Animated.loop;
const made: { stopped: boolean }[] = [];
vi.spyOn(Animated, 'loop').mockImplementation((anim, cfg) => {
  const loop = realLoop(anim, cfg);
  const mark = { stopped: false };
  made.push(mark);
  const stop = loop.stop.bind(loop);
  loop.stop = () => { mark.stopped = true; stop(); };
  return loop;
});
/** The loops started since `from`, and whether each has been stopped. */
const since = (from: number) => made.slice(from).map((m) => m.stopped);
vi.spyOn(Animated, 'timing');

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ t: (en: string) => en, lang: 'en' }),
}));

import { ScoreBadge, ScoreBlock, ScoreGlyph, ScoredCard, ScoringDialog, tenText, thereAndBack } from './PhotoScore';

const score = (over: Partial<PhotoScore> = {}): PhotoScore => ({
  scorer_version: SCORER_VERSION, aesthetic: 0.68, is_utility: false,
  signals: { brightness: 0.5, tilt: 4, labels: [{ id: 'interior_room', p: 0.8 }] }, ...over,
});

describe('tenText', () => {
  it('always writes one decimal, so a 7 lines up with a 7.5', () => {
    expect(tenText(7)).toBe('7.0');
    expect(tenText(8.4)).toBe('8.4');
  });
});

describe('ScoreBadge', () => {
  it('is the score out of ten', () => {
    render(<ScoreBadge score={score()} testID="b" />);
    expect(screen.getByTestId('b').textContent).toBe('8.4');
  });
  // The same glyph on every tile of a scored gallery said nothing the
  // tile beside it had not (owner, 15 Oct 2026).
  it('is the number alone, with no glyph', () => {
    render(<ScoreBadge score={score()} testID="b" />);
    expect(screen.getByTestId('b').querySelector('[data-icon]')).toBeNull();
  });
  it('is nothing for a row with no number', () => {
    render(<ScoreBadge score={score({ aesthetic: null })} testID="b" />);
    expect(screen.queryByTestId('b')).toBeNull();
  });
});

describe('ScoreBlock', () => {
  it('is the number, its word and the measured reasons', () => {
    render(<ScoreBlock score={score()} />);
    const block = screen.getByTestId('score-block');
    expect(block.textContent).toContain('8.4');
    expect(block.textContent).toContain('/10');
    expect(block.textContent).toContain('Very good');
    expect(screen.getByTestId('score-why').textContent).toBe('Well lit. Held back by: horizon tilted 4°.');
    expect(block.textContent).toContain('Apple Vision');
  });
  it('takes its word from the band the number falls in', () => {
    render(<ScoreBlock score={score({ aesthetic: -0.2 })} />);
    expect(screen.getByTestId('score-block').textContent).toContain('Weak');
  });
  it('is nothing for a row with no number', () => {
    render(<ScoreBlock score={score({ aesthetic: null })} />);
    expect(screen.queryByTestId('score-block')).toBeNull();
  });
});

describe('ScoringDialog', () => {
  it('counts the photo being read from one, and fills by what is done', () => {
    render(<ScoringDialog visible done={2} total={6} stopping={false} onCancel={() => {}} />);
    expect(screen.getByTestId('scoring-dialog').textContent).toContain('Reading the photos… 3/6');
    expect(screen.getByTestId('scoring-dialog').textContent).toContain('Analysed on this phone.');
    // The bars, not the sparkles that mean "suggested" elsewhere.
    expect(screen.getByTestId('scoring-dialog').querySelector('[data-icon]')).toBeNull();
    expect(screen.getAllByTestId('scoring-glyph-bar')).toHaveLength(3);
    expect(screen.getByTestId('scoring-fill').style.width).toBe('33.33333333333333%');
  });

  it('never counts past the last photo, and an empty run fills nothing', () => {
    render(<ScoringDialog visible done={6} total={6} stopping={false} onCancel={() => {}} />);
    expect(screen.getByTestId('scoring-dialog').textContent).toContain('6/6');
    render(<ScoringDialog visible done={0} total={0} stopping={false} onCancel={() => {}} />);
    expect(screen.getAllByTestId('scoring-fill')[1].style.width).toBe('0%');
  });

  it('cancels from its button, and says it is stopping once asked', () => {
    const onCancel = vi.fn();
    const from = made.length;
    const { rerender } = render(<ScoringDialog visible done={1} total={3} stopping={false} onCancel={onCancel} />);
    expect(since(from)).toEqual([false, false, false]);
    fireEvent.click(screen.getByTestId('scoring-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    rerender(<ScoringDialog visible done={1} total={3} stopping onCancel={onCancel} />);
    expect(screen.getByTestId('scoring-dialog').textContent).toContain('Stopping after this photo…');
    // The bars settle once Cancel is in: only the photo in hand is left.
    expect(since(from)).toEqual([true, true, true]);
    expect(screen.getByTestId('scoring-dialog').textContent).not.toContain('2/3');
  });

  it('is not drawn when not visible', () => {
    render(<ScoringDialog visible={false} done={0} total={3} stopping={false} onCancel={() => {}} />);
    expect(screen.queryByTestId('scoring-dialog')).toBeNull();
  });
});

describe('ScoredCard', () => {
  it('says how many were scored and which came out best', () => {
    render(<ScoredCard scored={6} failed={0} best={{ n: 3, ten: 8.6 }} onClose={() => {}} />);
    const card = screen.getByTestId('scored-card');
    expect(card.textContent).toContain('Scored 6 photos');
    expect(card.textContent).toContain('Best: photo 3 · 8.6');
    expect(screen.queryByTestId('scored-failed')).toBeNull();
  });

  it('says one photo in the singular, and counts the ones it could not read', () => {
    render(<ScoredCard scored={1} failed={2} best={null} onClose={() => {}} />);
    const card = screen.getByTestId('scored-card');
    expect(card.textContent).toContain('Scored 1 photo');
    expect(card.textContent).not.toContain('Best');
    expect(screen.getByTestId('scored-failed').textContent).toBe('2 could not be read');
  });

  it('closes from its ×', () => {
    const onClose = vi.fn();
    render(<ScoredCard scored={2} failed={0} best={null} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('scored-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ScoringDialog, closing', () => {
  // The Modal fades out after `visible` goes false, and the caller has
  // nothing left to count by then.
  it('keeps what it last said while it fades, rather than "0/0"', () => {
    const { rerender } = render(<ScoringDialog visible done={2} total={3} stopping={false} onCancel={() => {}} />);
    rerender(<ScoringDialog visible={false} done={0} total={0} stopping={false} onCancel={() => {}} />);
    expect(screen.getByTestId('scoring-dialog').textContent).toContain('3/3');
  });
});

describe('ScoreGlyph', () => {
  const loops = () => vi.mocked(Animated.loop).mock.calls.length;

  it('is three bars, short, tall and middling at rest', () => {
    render(<ScoreGlyph size={20} color="#123" testID="g" />);
    const bars = screen.getAllByTestId('g-bar');
    expect(bars).toHaveLength(3);
    expect(bars.map((b) => getComputedStyle(b).transform)).toEqual(['scaleY(0.55)', 'scaleY(1)', 'scaleY(0.75)']);
  });

  it('stays still unless active', () => {
    const before = loops();
    render(<ScoreGlyph size={15} color="#123" />);
    expect(loops()).toBe(before);
  });

  it('sets each bar moving on a loop of its own while active', () => {
    const before = loops();
    render(<ScoreGlyph size={22} color="#123" active />);
    expect(loops() - before).toBe(3);
  });

  // The owner saw the first build's bars stand still on the phone: each
  // was a sequence, which React Native cannot loop natively, so every leg
  // waited on a busy JS thread. One native timing per bar, out and back
  // in its easing, needs nothing from JavaScript once started.
  it('loops each bar as one native-driven timing, not a sequence', () => {
    const seq = vi.spyOn(Animated, 'sequence');
    vi.mocked(Animated.timing).mockClear();
    render(<ScoreGlyph size={22} color="#123" active />);
    expect(seq).not.toHaveBeenCalled();
    const configs = vi.mocked(Animated.timing).mock.calls.map((c) => c[1]);
    expect(configs).toHaveLength(3);
    for (const c of configs) {
      expect(c.useNativeDriver).toBe(true);
      expect(c.easing).toBe(thereAndBack);
    }
    seq.mockRestore();
  });

  it('eases out and back, at rest at both ends of the loop', () => {
    expect(thereAndBack(0)).toBe(0);
    expect(thereAndBack(0.5)).toBe(1);
    expect(thereAndBack(1)).toBeCloseTo(0, 12);
    expect(thereAndBack(0.25)).toBeCloseTo(0.5, 12);
  });

  // Never in step: three rhythms, no two alike.
  it('gives each bar a rhythm of its own, slow enough to read as looking', () => {
    vi.mocked(Animated.timing).mockClear();
    render(<ScoreGlyph size={22} color="#123" active />);
    const legs = vi.mocked(Animated.timing).mock.calls.map((c) => c[1].duration!);
    expect(new Set(legs).size).toBe(3);
    expect(Math.min(...legs)).toBeGreaterThanOrEqual(900);
  });

  it('stays still under Reduce Motion, active or not', async () => {
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValueOnce(true);
    const from = made.length;
    render(<ScoreGlyph size={22} color="#123" active testID="g" />);
    const before = loops();
    await act(async () => {});
    // The setting arrives a beat after the first render, and every loop
    // started before it is stopped.
    expect(since(from)).toEqual([true, true, true]);
    // The loops stop and every bar is back at its rest.
    expect(screen.getAllByTestId('g-bar').map((b) => getComputedStyle(b).transform))
      .toEqual(['scaleY(0.55)', 'scaleY(1)', 'scaleY(0.75)']);
    expect(loops()).toBe(before);
  });
});
