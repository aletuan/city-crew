// What counts as the server having ended the session — and what does not.

import { describe, expect, it } from 'vitest';
import { sessionGone } from './sessionGone';

describe('sessionGone', () => {
  // The Data Desk's global sign-out, 23 Oct 2026: `GET /user` → 403.
  it('is the session auth no longer has, or will not renew, or its user, or its refresh token', () => {
    for (const code of ['session_not_found', 'session_expired', 'user_not_found', 'refresh_token_not_found']) {
      expect(sessionGone({ code })).toBe(true);
    }
  });

  // Not proof the session is over: no network, a race of refreshes, a
  // token a moment past its expiry, a server having a bad minute.
  it('is not a failure that says nothing about the session', () => {
    for (const code of ['refresh_token_already_used', 'bad_jwt', 'request_timeout', 'unexpected_failure']) {
      expect(sessionGone({ code })).toBe(false);
    }
    expect(sessionGone({})).toBe(false);
    expect(sessionGone(null)).toBe(false);
    expect(sessionGone(undefined)).toBe(false);
  });
});
