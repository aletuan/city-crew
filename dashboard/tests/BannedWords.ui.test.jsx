// Banned words: the list the server reads on every comment written.
//
// What is pinned here is what the page promises the desk: that the list
// shown is the list the server holds (re-read after every change, never
// assumed), that an empty list says comments are unfiltered, and that
// the try-it box answers with the server's rule — whole words.

import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { api } from '../src/api.js';
import { findToast, renderDesk } from './_ui/desk.jsx';

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const listed = () => [...document.querySelectorAll('.banword span')].map((n) => n.textContent);

describe('Banned words', () => {
  it('says an empty list filters nothing', async () => {
    renderDesk('/banned-words');
    expect(await screen.findByText(/Comments are not filtered at all/)).toBeTruthy();
    expect(screen.getByText('(0)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add' }).disabled).toBe(true);
    expect(screen.getByRole('link', { name: '← Reports' }).getAttribute('href')).toBe('/reports');
  });

  it('adds what is new in the box, cleaned, and shows the list the server then holds', async () => {
    api.bannedWords.mockResolvedValueOnce(['foo']);
    renderDesk('/banned-words');
    await screen.findByText('foo');
    type(/Add words/, ' Ass \n\nfoo\nBuy Followers');
    // Two are new; "foo" is already there.
    const add = screen.getByRole('button', { name: 'Add 2' });
    api.bannedWords.mockResolvedValueOnce(['ass', 'buy followers', 'foo']);
    fireEvent.click(add);
    expect((await findToast()).textContent).toBe('Added 2 words');
    expect(api.addBannedWords).toHaveBeenCalledWith(['ass', 'buy followers']);
    await waitFor(() => expect(listed()).toEqual(['ass', 'buy followers', 'foo']));
    expect(screen.getByText('(3)')).toBeTruthy();
    // The box is emptied for the next sitting.
    expect(screen.getByLabelText(/Add words/).value).toBe('');
  });

  it('says one word in the singular', async () => {
    renderDesk('/banned-words');
    await screen.findByText(/Comments are not filtered/);
    type(/Add words/, 'ass');
    fireEvent.click(screen.getByRole('button', { name: 'Add 1' }));
    expect((await findToast()).textContent).toBe('Added 1 word');
  });

  it('removes one word by its own button, and re-reads the list', async () => {
    api.bannedWords.mockResolvedValueOnce(['ass', 'foo']);
    renderDesk('/banned-words');
    await screen.findByText('foo');
    api.bannedWords.mockResolvedValueOnce(['foo']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove “ass”' }));
    expect((await findToast()).textContent).toBe('Removed “ass”');
    expect(api.removeBannedWord).toHaveBeenCalledWith('ass');
    await waitFor(() => expect(listed()).toEqual(['foo']));
  });

  it('keeps the list and the typing when a change fails', async () => {
    api.bannedWords.mockResolvedValue(['foo']);
    api.addBannedWords.mockRejectedValue(new Error('not an editor'));
    renderDesk('/banned-words');
    await screen.findByText('foo');
    type(/Add words/, 'ass');
    fireEvent.click(screen.getByRole('button', { name: 'Add 1' }));
    expect((await findToast()).textContent).toBe('not an editor');
    expect(listed()).toEqual(['foo']);
    expect(screen.getByLabelText(/Add words/).value).toBe('ass');
    // And it can be tried again.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add 1' }).disabled).toBe(false));
  });

  it('does not call a list it could not read an empty one', async () => {
    api.bannedWords.mockRejectedValue(new Error('offline'));
    renderDesk('/banned-words');
    expect((await findToast()).textContent).toBe("Couldn't load the banned words: offline");
    expect(await screen.findByRole('heading', { name: 'Banned words' })).toBeTruthy();
  });

  it('answers "would this be stopped?" by whole words, as the server does', async () => {
    api.bannedWords.mockResolvedValue(['ass', 'buy followers']);
    renderDesk('/banned-words');
    await screen.findByText('ass');
    // Nothing typed, nothing said.
    expect(screen.queryByTestId('ban-verdict')).toBeNull();
    type(/Would this comment be stopped/, 'What a class act');
    expect(screen.getByTestId('ban-verdict').textContent).toBe('Not stopped by the list as it stands.');
    type(/Would this comment be stopped/, 'Buy followers, ASS!');
    expect(screen.getByTestId('ban-verdict').textContent).toBe('Stopped — it contains “ass”, “buy followers”.');
    // The try-it box is not the add box: nothing was sent.
    expect(api.addBannedWords).not.toHaveBeenCalled();
    expect(within(screen.getByTestId('ban-verdict').closest('section')).queryByRole('button')).toBeNull();
  });
});
