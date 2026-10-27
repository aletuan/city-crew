import { describe, expect, it, vi } from 'vitest';
import { cleanupFixture } from './maestro-account.mjs';

const id = '12345678-1234-1234-1234-123456789abc';
const fixture = { owner: 'citycrew-maestro-signup-v1', id,
  email: `maestro-e2e-${id}@example.com`, password: 'Smoke-test-password-1!',
  url: 'https://project.example.com', key: 'public-test-key' };
const response = (status: number, data: object) => new Response(JSON.stringify(data), { status });
const absent = () => response(400, { code: 400, error_code: 'invalid_credentials' });
const signedIn = () => response(200, { access_token: 'own-session', user: { email: fixture.email } });

describe('disposable Maestro account cleanup', () => {
  it('never authenticates or deletes a persistent account', async () => {
    const fetcher = vi.fn();
    await expect(cleanupFixture({ ...fixture, email: 'persistent@example.com' }, fetcher)).rejects.toThrow('Refusing');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('accepts credentials rejected after UI deletion without calling delete again', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(absent());
    expect(await cleanupFixture(fixture, fetcher)).toBe('absent');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('recovers an interrupted signup using only that user session, then verifies deletion', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(signedIn())
      .mockResolvedValueOnce(response(200, { ok: true })).mockResolvedValueOnce(absent());
    expect(await cleanupFixture(fixture, fetcher)).toBe('recovered');
    expect(fetcher.mock.calls[1][0]).toMatch(/\/functions\/v1\/delete-account$/);
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe('Bearer own-session');
    expect(fetcher.mock.calls[1][1].body).toBe('{}');
  });
  it('refuses a session for a different user', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(200, {
      access_token: 'wrong-session', user: { email: 'other@example.com' },
    }));
    await expect(cleanupFixture(fixture, fetcher)).rejects.toThrow('identity');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([429, 500])('does not mistake HTTP %s for an absent account', async (status) => {
    await expect(cleanupFixture(fixture, vi.fn().mockResolvedValue(response(status, {}))))
      .rejects.toThrow('ledger retained');
  });
  it('keeps recovery possible when deletion fails', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(signedIn()).mockResolvedValueOnce(response(500, {}));
    await expect(cleanupFixture(fixture, fetcher)).rejects.toThrow('ledger retained');
  });
  it('does not trust a success response while credentials still work', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(signedIn())
      .mockResolvedValueOnce(response(200, { ok: true })).mockResolvedValueOnce(signedIn());
    await expect(cleanupFixture(fixture, fetcher)).rejects.toThrow('Deletion not verified');
  });
});
