// @vitest-environment jsdom
//
// Taking a visit back — see `useRemoveCheckin.tsx` for why it is one hook.
// The two screens' own tests cover the path through each of them; this is
// the removal itself, success and failure, once.

import { Alert } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '../uitest/render';

const removeCheckin = vi.hoisted(() => vi.fn(async (_id: string) => {}));
vi.mock('./data', async (orig) => ({ ...(await orig<Record<string, unknown>>()), removeCheckin }));

import { useRemoveCheckin } from './useRemoveCheckin';

afterEach(() => { vi.restoreAllMocks(); removeCheckin.mockReset().mockResolvedValue(undefined); });

describe('useRemoveCheckin', () => {
  it('deletes the visit it is given, then reloads the list', async () => {
    const order: string[] = [];
    removeCheckin.mockImplementation(async () => { order.push('delete'); });
    const reload = vi.fn(() => { order.push('reload'); });
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => useRemoveCheckin(reload));
    await result.current('k7');
    expect(removeCheckin).toHaveBeenCalledWith('k7');
    // After, not before: a reload that ran first would show the visit again.
    expect(order).toEqual(['delete', 'reload']);
    expect(alert).not.toHaveBeenCalled();
  });

  it('says so, with the reason, and does not reload, when the delete fails', async () => {
    removeCheckin.mockRejectedValue(new Error('offline'));
    const reload = vi.fn();
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => useRemoveCheckin(reload));
    await expect(result.current('k7')).resolves.toBeUndefined();
    expect(alert).toHaveBeenCalledWith('Could not remove it', 'offline');
    // The list is still what the server has: reloading would only repeat it.
    expect(reload).not.toHaveBeenCalled();
  });
});
