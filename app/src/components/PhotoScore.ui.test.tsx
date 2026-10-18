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
import type { PhotoScore } from '../lib/photoScore';
import { colors } from '../theme';

/** A token as the DOM reports it: `#rrggbb` becomes `rgb(r, g, b)`, and
 *  an `rgba(…)` gains the spaces the browser puts in. */
const rgb = (c: unknown) => {
  const v = String(c);
  if (!v.startsWith('#')) return v.replace(/,(?=\S)/g, ', ');
  const n = parseInt(v.slice(1, 7), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};

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

import { ScoreBadge, ScoreDetails, ScoreGlyph, ScoreTen, ScoreWhy, ScoredCard, ScoringDialog, tenText, thereAndBack } from './PhotoScore';

const score = (over: Partial<PhotoScore> = {}): PhotoScore => ({
  scorer: 'apple-vision', scorer_version: 1, aesthetic: 0.68, is_utility: false,
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

describe('ScoreTen', () => {
  it('is the number out of ten, with the word for its band beneath', () => {
    render(<ScoreTen score={score()} />);
    const ten = screen.getByTestId('score-ten');
    expect(ten.textContent).toBe('8.4/10Very good');
  });
  it('takes its word from the band the number falls in', () => {
    render(<ScoreTen score={score({ aesthetic: -0.2 })} />);
    expect(screen.getByTestId('score-ten').textContent).toContain('Weak');
  });
  // The rows' two tones and a neutral: green for the bands that say the
  // photograph is good, amber for the one that says it is held back.
  it('inks its word green, plain or amber by band', () => {
    const pill = (aesthetic: number) => {
      const { unmount } = render(<ScoreTen score={score({ aesthetic })} />);
      const el = screen.getByTestId('score-band');
      const out = [getComputedStyle(el).backgroundColor, getComputedStyle(el.firstElementChild as HTMLElement).color];
      unmount();
      return out;
    };
    expect(pill(0.68)).toEqual([rgb(colors.okSoft), rgb(colors.okInk)]);
    expect(pill(0.4)).toEqual([rgb(colors.okSoft), rgb(colors.okInk)]);
    expect(pill(0.1)).toEqual([rgb(colors.surfaceGlassStrong), rgb(colors.textSecondary)]);
    expect(pill(-0.2)).toEqual([rgb(colors.warnSoft), rgb(colors.warnInk)]);
  });
  // Its number is every scorer's to show, whoever read the row.
  it('shows the number of a scorer this build cannot interpret', () => {
    render(<ScoreTen score={score({ scorer: 'later-model' })} />);
    expect(screen.getByTestId('score-ten').textContent).toContain('8.4');
  });
  it('is nothing for a row with no number', () => {
    render(<ScoreTen score={score({ aesthetic: null })} />);
    expect(screen.queryByTestId('score-ten')).toBeNull();
  });
});

describe('ScoreWhy', () => {
  // Who measured lives in the detailed analysis now (owner, 16 Oct 2026).
  it('is the measured reasons, and not who measured', () => {
    render(<ScoreWhy score={score()} />);
    expect(screen.getByTestId('score-why').textContent).toBe('Well lit. Held back by: horizon tilted 4°.');
    expect(screen.queryByTestId('score-source')).toBeNull();
  });
  // A row a later app wrote: its measurements are not Vision's to read.
  it('gives no reasons for a scorer it cannot interpret', () => {
    render(<ScoreWhy score={score({ scorer: 'later-model' })} />);
    expect(screen.queryByTestId('score-why')).toBeNull();
    expect(screen.queryByTestId('score-source')).toBeNull();
  });
  it('gives no reasons for a row with no number', () => {
    render(<ScoreWhy score={score({ aesthetic: null })} />);
    expect(screen.queryByTestId('score-why')).toBeNull();
  });
});

describe('ScoreDetails', () => {
  // Sharp, level, with a crowd and a tilted horizon to suggest about.
  const measured = score({
    aesthetic: 0.635,
    signals: { brightness: 0.5, sharpness: 2768, tilt: 6, labels: [{ id: 'interior_room', p: 0.8 }], peopleArea: 0.4, textLines: 0 },
  });

  it('is folded until opened, and opens from its head', () => {
    const onToggle = vi.fn();
    render(<ScoreDetails score={measured} open={false} onToggle={onToggle} />);
    const toggle = screen.getByTestId('score-detail-toggle');
    expect(toggle.textContent).toBe('Detailed analysis');
    expect(toggle.querySelector('[data-icon="chevron-down"]')).not.toBeNull();
    expect(screen.queryByTestId('score-detail-light')).toBeNull();
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('opens on where the number stands, then a row per measured quality', () => {
    render(<ScoreDetails score={measured} open onToggle={() => {}} />);
    expect(screen.getByTestId('score-detail-toggle').querySelector('[data-icon="chevron-up"]')).not.toBeNull();
    expect(screen.getByTestId('score-standing').textContent).toBe('Scores higher than 80% of the catalog\'s photos');
    expect(screen.getByTestId('score-detail-light').textContent).toBe('LightWell lit');
    expect(screen.getByTestId('score-detail-composition').textContent).toBe('CompositionHorizon tilted 6°, people fill much of the frame');
    expect(screen.queryByTestId('score-detail-green')).toBeNull();
  });

  // With a sure kind, the number stands among that kind (0.635 is 80%
  // of the catalog, 90% of interiors), and both readers are named.
  it('places the number among its own kind, and names Claude beside Vision', () => {
    render(<ScoreDetails score={measured} kind="interior" open onToggle={() => {}} />);
    expect(screen.getByTestId('score-standing').textContent).toBe('Scores higher than 90% of the catalog\'s interior photos');
    expect(screen.getByTestId('score-source').textContent).toBe('Photo analysed by Apple Vision and Claude.');
  });

  // A kind too few to have a spread of its own: the catalog's standing,
  // still with both readers named, since the kind is shown above.
  it('falls back to the whole catalog for a kind with no spread', () => {
    render(<ScoreDetails score={measured} kind="view" open onToggle={() => {}} />);
    expect(screen.getByTestId('score-standing').textContent).toBe('Scores higher than 80% of the catalog\'s photos');
    expect(screen.getByTestId('score-source').textContent).toBe('Photo analysed by Apple Vision and Claude.');
  });

  // Who measured, for the reader who opened the analysis — last, and only
  // once it is open.
  it('says who measured, last, once opened', () => {
    const { rerender } = render(<ScoreDetails score={measured} open={false} onToggle={() => {}} />);
    expect(screen.queryByTestId('score-source')).toBeNull();
    rerender(<ScoreDetails score={measured} open onToggle={() => {}} />);
    const source = screen.getByTestId('score-source');
    expect(source.textContent).toBe('Analysed on this phone by Apple Vision.');
    expect(source.querySelector('[data-icon="information-circle-outline"]')).not.toBeNull();
    expect(source.nextElementSibling).toBeNull();
  });

  // The glyph says what the row is about; the ink of its words, how it
  // went — green, amber, or plain on every look.
  it('marks each row with its quality, and inks its words by how it went', () => {
    render(<ScoreDetails score={measured} open onToggle={() => {}} />);
    const glyph = (key: string) => screen.getByTestId(`score-detail-${key}`).querySelector('[data-icon]')!.getAttribute('data-icon');
    expect(glyph('light')).toBe('sunny-outline');
    expect(glyph('focus')).toBe('locate-outline');
    expect(glyph('composition')).toBe('scan-outline');
    const ink = (key: string) => getComputedStyle(screen.getByTestId(`score-detail-${key}-value`)).color;
    expect(ink('light')).toBe(rgb(colors.okInk));
    expect(ink('composition')).toBe(rgb(colors.warnInk));
  });

  // Neither helped nor held back: plain words, and a grey bar, so a full
  // bar of "no problems found" does not read as praise.
  it('inks a row that neither helped nor held back plainly, bar and all', () => {
    render(<ScoreDetails score={score({ signals: { brightness: 0.3, peopleArea: 0 } })} open onToggle={() => {}} />);
    expect(getComputedStyle(screen.getByTestId('score-detail-light-value')).color).toBe(rgb(colors.textSecondary));
    expect(getComputedStyle(screen.getByTestId('score-detail-composition-bar')).backgroundColor).toBe(rgb(colors.textTertiary));
    expect(screen.getByTestId('score-detail-composition-bar').style.width).toBe('100%');
  });

  // A bar on every row, as full as the row says, amber where the
  // quality held the photograph back and green otherwise.
  it('draws every row\'s bar, as full as its measurement, in its tone', () => {
    render(<ScoreDetails score={measured} open onToggle={() => {}} />);
    const bar = (key: string) => screen.getByTestId(`score-detail-${key}-bar`);
    expect(bar('light').style.width).toBe('100%');
    expect(bar('focus').style.width).toBe('80%');
    expect(bar('composition').style.width).toBe('33%');
    expect(getComputedStyle(bar('focus')).backgroundColor).toBe(rgb(colors.okInk));
    expect(getComputedStyle(bar('composition')).backgroundColor).toBe(rgb(colors.warnInk));
  });

  it('suggests what would have helped, and only when something held it back', () => {
    const { unmount } = render(<ScoreDetails score={measured} open onToggle={() => {}} />);
    const tips = screen.getByTestId('score-tips');
    expect(tips.textContent).toContain('To improve');
    expect(tips.textContent).toContain('Straighten it');
    expect(tips.textContent).toContain('fewer people');
    // The bulb heads the box; each tip wears its quality's mark.
    const marks = [...tips.querySelectorAll('[data-icon]')].map((el) => el.getAttribute('data-icon'));
    expect(marks).toEqual(['bulb-outline', 'scan-outline', 'scan-outline']);
    unmount();
    render(<ScoreDetails score={score({ signals: { brightness: 0.5 } })} open onToggle={() => {}} />);
    expect(screen.queryByTestId('score-tips')).toBeNull();
  });

  it('is nothing for a scorer it cannot read, or a row with no number', () => {
    const { rerender } = render(<ScoreDetails score={score({ scorer: 'later-model' })} open onToggle={() => {}} />);
    expect(screen.queryByTestId('score-detail')).toBeNull();
    rerender(<ScoreDetails score={score({ aesthetic: null })} open onToggle={() => {}} />);
    expect(screen.queryByTestId('score-detail')).toBeNull();
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
