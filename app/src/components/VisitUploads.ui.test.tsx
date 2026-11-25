// @vitest-environment jsdom
//
// What the app says of a check-in photo that ends with no sheet up: the
// visits asked again when it lands, a refusal in words, a lost one with a
// choice — and nothing at all while a sheet over the visit is up to say
// it itself.

import React from 'react';
import { Alert, type AlertButton } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '../uitest/render';
import { PhotoError } from '../lib/checkin';

const upload = vi.hoisted(() => vi.fn());
vi.mock('../lib/data/checkinPhotos', () => ({ uploadCheckinPhoto: upload }));
const mine = vi.hoisted(() => ({ reload: vi.fn() }));
vi.mock('../lib/checkins', () => ({ useMyCheckins: () => mine }));
vi.mock('../lib/i18n', () => ({ useI18n: () => ({ lang: 'en', t: (en: string) => en }) }));

import VisitUploads from './VisitUploads';
import { resetVisitUploads, sendVisitPhoto, uploadsFor, uploadsSettled, watchVisit } from '../lib/visitUploads';

const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
const send = async () => {
  act(() => { sendVisitPhoto({ key: 'a', visitId: 'k1', uri: 'file://a', image: 'AAAA' }); });
  await act(() => uploadsSettled());
};

beforeEach(() => {
  resetVisitUploads();
  upload.mockReset();
  upload.mockResolvedValue({ id: 'p', path: 'u/k1/p.jpg', width: 1, height: 1 });
  render(<VisitUploads />);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('VisitUploads', () => {
  it('asks for the visits again when a photo lands with no sheet up', async () => {
    await send();
    expect(mine.reload).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it('leaves everything to a sheet that is up over the visit', async () => {
    const unwatch = watchVisit('k1');
    upload.mockRejectedValueOnce(new Error('offline'));
    await send();
    expect(mine.reload).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    unwatch();
  });

  it('says a refusal once, in the sheet’s words', async () => {
    upload.mockRejectedValueOnce(new PhotoError('day'));
    await send();
    expect(alert).toHaveBeenCalledWith('Could not add your photo', 'You have added 15 photos today. Add more tomorrow.');
    expect(mine.reload).not.toHaveBeenCalled();
  });

  it('asks about a lost one: let it go, or try again with the same bytes', async () => {
    upload.mockRejectedValueOnce(new Error('Network request failed'));
    await send();
    const [title, , buttons] = alert.mock.calls[0] as [string, string, AlertButton[]];
    expect(title).toBe('A photo did not upload');
    expect(buttons.map((b) => [b.text, b.style])).toEqual([['Discard photo', 'destructive'], ['Try again', undefined]]);

    act(() => { buttons[1].onPress!(); });
    await act(() => uploadsSettled());
    expect(upload).toHaveBeenLastCalledWith('k1', 'AAAA');
    expect(mine.reload).toHaveBeenCalledTimes(1);
  });

  it('lets a lost one go when told to', async () => {
    upload.mockRejectedValueOnce(new Error('Network request failed'));
    await send();
    const buttons = alert.mock.calls[0][2] as AlertButton[];
    act(() => { buttons[0].onPress!(); });
    expect(uploadsFor('k1')).toEqual([]);
  });
});
