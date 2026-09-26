// Search words: one box per category, one term per line.
//
// Pinned here: the box mirrors the app's own guard (terms under three
// letters are dropped, CJK excepted), Save is only offered for a real
// change, and what comes back from a save — trimmed, de-duplicated —
// replaces what was typed rather than sitting beside it.

import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { api } from '../src/api.js';
import { findToast, renderDesk } from './_ui/desk.jsx';

const panel = (label) => screen.getByRole('heading', { name: new RegExp(`^${label}`) }).closest('section');
const box = (cat) => screen.getByLabelText(new RegExp('Extra search words'), { selector: `#terms-${cat}` });

describe('SearchTerms', () => {
  it('loads a box per category, seeded with what is saved', async () => {
    api.categoryTerms.mockResolvedValue({ fun: ['cinema', 'rạp phim'] });
    renderDesk('/search-words');
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: /^fun/ })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(9);
    expect(box('fun').value).toBe('cinema\nrạp phim');
    expect(within(panel('fun')).getByText('(2)')).toBeTruthy();
    expect(box('cafes').value).toBe('');
    expect(within(panel('cafés')).getByText('(0)')).toBeTruthy();
    // Nothing to save yet, anywhere.
    for (const b of screen.getAllByRole('button', { name: 'Save' })) expect(b.disabled).toBe(true);
  });

  it('counts the lines, warns about the ones the app will ignore, and offers Save for a change', async () => {
    api.categoryTerms.mockResolvedValue({});
    renderDesk('/search-words');
    await screen.findByRole('heading', { name: /^fun/ });
    fireEvent.change(box('fun'), { target: { value: 'cinema\nab\n映画\n\n  bowling  ' } });
    expect(within(panel('fun')).getByText('(4)')).toBeTruthy();
    expect(within(panel('fun')).getByText(/The app ignores “ab” — under 3 letters/)).toBeTruthy();
    expect(within(panel('fun')).getByRole('button', { name: 'Save' }).disabled).toBe(false);
    // Another panel is untouched by it.
    expect(within(panel('eats')).getByRole('button', { name: 'Save' }).disabled).toBe(true);
    // Typing the saved value back is not a change.
    fireEvent.change(box('fun'), { target: { value: '\n' } });
    expect(within(panel('fun')).getByRole('button', { name: 'Save' }).disabled).toBe(true);
    expect(within(panel('fun')).queryByText(/The app ignores/)).toBeNull();
  });

  it('saves the lines, shows what the desk kept, and says so', async () => {
    api.categoryTerms.mockResolvedValue({ fun: ['cinema'] });
    api.saveCategoryTerms.mockResolvedValue(['cinema', 'bowling']);
    renderDesk('/search-words');
    await screen.findByRole('heading', { name: /^fun/ });
    fireEvent.change(box('fun'), { target: { value: 'cinema\n bowling \nbowling' } });
    fireEvent.click(within(panel('fun')).getByRole('button', { name: 'Save' }));
    expect((await findToast()).textContent).toBe('Saved 2 terms for fun');
    expect(api.saveCategoryTerms).toHaveBeenCalledWith('fun', ['cinema', 'bowling', 'bowling']);
    // The cleaned list is what the box shows now, and it is no longer dirty.
    await waitFor(() => expect(box('fun').value).toBe('cinema\nbowling'));
    expect(within(panel('fun')).getByRole('button', { name: 'Save' }).disabled).toBe(true);
  });

  it('a single term is singular', async () => {
    api.categoryTerms.mockResolvedValue({});
    api.saveCategoryTerms.mockResolvedValue(['laptop']);
    renderDesk('/search-words');
    await screen.findByRole('heading', { name: /^focus/ });
    fireEvent.change(box('focus'), { target: { value: 'laptop' } });
    fireEvent.click(within(panel('focus')).getByRole('button', { name: 'Save' }));
    expect((await findToast()).textContent).toBe('Saved 1 term for focus');
  });

  it('says why a save failed and keeps the typing', async () => {
    api.categoryTerms.mockResolvedValue({});
    api.saveCategoryTerms.mockRejectedValue(new Error('not an editor'));
    renderDesk('/search-words');
    await screen.findByRole('heading', { name: /^fun/ });
    fireEvent.change(box('fun'), { target: { value: 'cinema' } });
    fireEvent.click(within(panel('fun')).getByRole('button', { name: 'Save' }));
    expect((await findToast()).textContent).toBe('Save failed: not an editor');
    expect(box('fun').value).toBe('cinema');
    expect(within(panel('fun')).getByRole('button', { name: 'Save' }).disabled).toBe(false);
  });

  it('a table that cannot be read leaves every box empty and says so once', async () => {
    api.categoryTerms.mockRejectedValue(new Error('relation missing'));
    renderDesk('/search-words');
    expect((await findToast()).textContent).toBe("Couldn't load search words: relation missing");
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(9);
    expect(box('fun').value).toBe('');
  });
});
