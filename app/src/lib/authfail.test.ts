import { describe, expect, it } from 'vitest';
import { authFail, type AuthFail } from './authfail';

// Every code the module claims to know, asserted as a table rather than as
// eleven `it`s. The point of the table is that adding a row to `BY_CODE`
// without adding one here is the kind of thing the coverage gate catches
// and a reviewer does not.
const KNOWN: [string, AuthFail][] = [
  ['invalid_credentials', 'credentials'],
  ['email_not_confirmed', 'unconfirmed'],
  ['user_already_exists', 'email_taken'],
  ['email_exists', 'email_taken'],
  ['weak_password', 'weak_password'],
  ['otp_expired', 'bad_code'],
  ['over_request_rate_limit', 'rate_limit'],
  ['over_email_send_rate_limit', 'rate_limit'],
  ['email_address_invalid', 'bad_email'],
  ['same_password', 'same_password'],
];

describe('authFail', () => {
  it.each(KNOWN)('names %s', (code, expected) => {
    // The message is deliberately the wrong answer in every case: it is
    // there to prove the code is what decided.
    expect(authFail(code, 'Network request failed')).toBe(expected);
  });

  // The two failures that most need telling apart, and the reason this
  // module returns names instead of one sentence. Somebody whose email is
  // unconfirmed has typed the right password.
  it('keeps a wrong password and an unconfirmed address apart', () => {
    expect(authFail('invalid_credentials', 'Invalid login credentials'))
      .not.toBe(authFail('email_not_confirmed', 'Email not confirmed'));
  });

  it('has no name for a code it was not taught', () => {
    expect(authFail('signup_disabled', 'Signups not allowed for this instance')).toBeNull();
    expect(authFail('user_banned', 'User is banned')).toBeNull();
  });

  // Knowingly unmapped: the code covers a bad address and a missing
  // password alike, and guessing which would name the wrong field.
  it('leaves validation_failed to the server’s own words', () => {
    expect(authFail('validation_failed', 'Unable to validate email address: invalid format')).toBeNull();
  });

  describe('with no code, which is how a failed request arrives', () => {
    it('recognises the platforms this can run on', () => {
      // React Native, the web build, and Firefox, in that order.
      expect(authFail(undefined, 'Network request failed')).toBe('offline');
      expect(authFail(undefined, 'Failed to fetch')).toBe('offline');
      expect(authFail(undefined, 'NetworkError when attempting to fetch resource.')).toBe('offline');
    });

    it('does not care how the platform cased it', () => {
      expect(authFail(undefined, 'network request failed')).toBe('offline');
    });

    it('says nothing about a codeless error that is not a network one', () => {
      expect(authFail(undefined, 'Something else went wrong')).toBeNull();
      expect(authFail(undefined, '')).toBeNull();
    });
  });

  // A refusal that happens to mention a network is still a refusal. The
  // code is checked first for exactly this: told "offline" instead, a
  // reader would go looking at their wifi over a server that answered.
  it('trusts the code over a message that reads like a network failure', () => {
    expect(authFail('user_banned', 'Failed to fetch')).toBeNull();
    expect(authFail('invalid_credentials', 'Failed to fetch')).toBe('credentials');
  });
});
