// Scan city: one Edge Function call per category, in order, with the row
// reporting as it goes.
//
// The order and the cancel are what matter. Twenty categories at eight
// imports each is the biggest write the desk can make in one press, and
// "Cancel after this category" is the only brake — a cancel that did not
// stop the loop, or a loop that fired every call at once, would each be
// invisible in a unit test of the function it calls.

import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { api } from '../src/api.js';
import { findToast, renderDesk } from './_ui/desk.jsx';

/** The Scan button, once the categories and the city have both arrived
 *  and it is pressable — pressing it disabled would run nothing. */
const scanButton = async (name = 'Scan Hanoi') => {
  const button = await screen.findByRole('button', { name });
  await waitFor(() => expect(button.disabled).toBe(false));
  return button;
};

const CATS = [
  { key: 'coffee', label_en: 'Coffee', label_vi: 'Cà phê', category: 'food' },
  { key: 'parks', label_en: 'Parks', label_vi: 'Công viên', category: 'out' },
];

describe('ScanCity', () => {
  it('asks for a city first when the desk is on all cities', async () => {
    renderDesk('/scan', { city: 'all' });
    expect(await screen.findByText('One city at a time')).toBeTruthy();
  });

  it('loads the categories and names the city on the button', async () => {
    let finish;
    api.scanCategories.mockReturnValue(new Promise((r) => { finish = r; }));
    renderDesk('/scan', { city: 'hanoi' });
    expect(await screen.findByText('Loading categories…')).toBeTruthy();
    finish({ categories: CATS });
    expect(await screen.findByText('Coffee')).toBeTruthy();
    expect(screen.getByText('Cà phê')).toBeTruthy();
    expect(screen.getByText('food').className).toContain('tag');
    const run = screen.getByRole('button', { name: 'Scan Hanoi' });
    expect(run.disabled).toBe(false);
    // Nothing has run: every row wears the quiet mark.
    expect(screen.getAllByText('·')).toHaveLength(2);
  });

  it('cannot start until the categories are there', async () => {
    let finish;
    api.scanCategories.mockReturnValue(new Promise((r) => { finish = r; }));
    renderDesk('/scan', { city: 'hanoi' });
    expect((await screen.findByRole('button', { name: 'Scan Hanoi' })).disabled).toBe(true);
    finish({ categories: CATS });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Scan Hanoi' }).disabled).toBe(false));
  });

  it('says so when the categories cannot be read', async () => {
    api.scanCategories.mockRejectedValue(new Error('no function'));
    renderDesk('/scan');
    expect((await findToast()).textContent).toBe("Couldn't load scan categories: no function");
  });

  it('scans the categories one after another and reports each row', async () => {
    api.scanCategories.mockResolvedValue({ categories: CATS });
    const order = [];
    api.scanCity.mockImplementation(async (city, key) => {
      order.push(key);
      if (key === 'coffee') {
        return { imported: [{ name: 'Cộng' }, { name: 'Giảng' }], skipped_existing: 1, errors: ['Loading 404'] };
      }
      return { imported: [], skipped_existing: 0, errors: [] };
    });
    renderDesk('/scan', { city: 'hanoi' });
    fireEvent.click(await scanButton());
    expect(await screen.findByText('2 imported · 1 already known · 1 errors')).toBeTruthy();
    expect(await screen.findByText('0 imported')).toBeTruthy();
    expect(order).toEqual(['coffee', 'parks']);
    expect(api.scanCity).toHaveBeenCalledWith('hanoi', 'coffee');
    // The imported names replace the Vietnamese label; the errors get a line.
    expect(screen.getByText('Cộng · Giảng')).toBeTruthy();
    expect(screen.getByText('Loading 404')).toBeTruthy();
    expect(screen.getByText('Công viên')).toBeTruthy();
    expect((await findToast()).textContent).toBe('Scan finished — 2 new pending places in Hanoi');
    await waitFor(() => expect(api.progress).toHaveBeenCalledTimes(2));
  });

  it('a category that fails is marked and the scan carries on', async () => {
    api.scanCategories.mockResolvedValue({ categories: CATS });
    api.scanCity.mockImplementation(async (_city, key) => {
      if (key === 'coffee') throw new Error('quota');
      return { imported: [{ name: 'Thống Nhất' }], skipped_existing: 0, errors: [] };
    });
    renderDesk('/scan', { city: 'hanoi' });
    fireEvent.click(await scanButton());
    const failed = await screen.findByText('failed: quota');
    expect(failed.className).toContain('flagged');
    expect((await screen.findByText('1 imported')).className).toContain('approved');
    expect((await findToast()).textContent).toBe('Scan finished — 1 new pending places in Hanoi');
  });

  it('cancel stops after the category in flight', async () => {
    api.scanCategories.mockResolvedValue({ categories: CATS });
    let finish;
    api.scanCity.mockReturnValueOnce(new Promise((r) => { finish = r; }));
    renderDesk('/scan', { city: 'hanoi' });
    fireEvent.click(await scanButton());
    expect((await screen.findByText('scanning…')).className).toContain('pending');
    expect(screen.getByRole('button', { name: 'Scanning…' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel after this category' }));
    finish({ imported: [{ name: 'Cộng' }], skipped_existing: 0, errors: [] });
    expect((await findToast()).textContent).toBe('Scan cancelled — 1 places imported so far');
    expect(api.scanCity).toHaveBeenCalledTimes(1);
    // The brake is gone with the run, and the button is back.
    expect(screen.queryByRole('button', { name: 'Cancel after this category' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Scan Hanoi' }).disabled).toBe(false);
  });
});
