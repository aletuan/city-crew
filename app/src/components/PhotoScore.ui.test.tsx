// @vitest-environment jsdom
//
// The four drawings of a photo's score. What is pinned is what the guide
// reads — the number and how it is written, the word, the reasons, how
// far a run has got, and the ways out — not the arithmetic, which is
// `lib/photoScore`'s and tested there.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';
import { SCORER_VERSION, type PhotoScore } from '../lib/photoScore';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ t: (en: string) => en, lang: 'en' }),
}));

import { ScoreBadge, ScoreBlock, ScoredCard, ScoringDialog, tenText } from './PhotoScore';

const score = (over: Partial<PhotoScore> = {}): PhotoScore => ({
  scorer_version: SCORER_VERSION, aesthetic: 0.68, is_utility: false,
  signals: { brightness: 0.5, tilt: 4 }, ...over,
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
    const { rerender } = render(<ScoringDialog visible done={1} total={3} stopping={false} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('scoring-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    rerender(<ScoringDialog visible done={1} total={3} stopping onCancel={onCancel} />);
    expect(screen.getByTestId('scoring-dialog').textContent).toContain('Stopping after this photo…');
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
