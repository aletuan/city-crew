import { describe, expect, it } from 'vitest';
import { authFail, fixedOnForm, obfuscatedSignUp, sentenceCase, type AuthFail } from './authfail';

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
  ['validation_failed', 'bad_input'],
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

  // It covers a bad address and a missing password alike, so the sentence
  // behind this name is the one that points at no field — see the note on
  // `BY_CODE`. What matters here is only that it stops being English.
  it('names validation_failed whatever prose it carries', () => {
    expect(authFail('validation_failed', 'missing email or phone')).toBe('bad_input');
    expect(authFail('validation_failed', 'Password recovery requires an email')).toBe('bad_input');
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

describe('sentenceCase', () => {
  // The message that prompted this: GoTrue's answer to an empty sign-in
  // form, which arrives lower case and sat in a banner looking leaked.
  it('starts a server sentence like a sentence', () => {
    expect(sentenceCase('missing email or phone')).toBe('Missing email or phone');
  });

  it('leaves one that already was', () => {
    expect(sentenceCase('Password recovery requires an email'))
      .toBe('Password recovery requires an email');
  });

  // Only the first character. The rest is the server's, and an error
  // naming a type or a column means those exactly as they are.
  it('touches nothing past the first character', () => {
    expect(sentenceCase('unexpected AuthApiError on profiles.handle'))
      .toBe('Unexpected AuthApiError on profiles.handle');
  });

  it('has nothing to say about nothing', () => {
    expect(sentenceCase('')).toBe('');
  });
});

describe('obfuscatedSignUp', () => {
  it('reads an empty identities list as a taken address', () => {
    expect(obfuscatedSignUp([])).toBe(true);
  });

  it('reads a real identity as a real sign-up', () => {
    expect(obfuscatedSignUp([{ provider: 'email' }])).toBe(false);
  });

  // The rule the docstring states: absent must mean "unknown", never
  // "taken". A response GoTrue reshapes tomorrow costs a duplicate
  // slipping through, not a real reader being refused.
  it('reads anything that is not a list as unknown', () => {
    expect(obfuscatedSignUp(undefined)).toBe(false);
    expect(obfuscatedSignUp(null)).toBe(false);
    expect(obfuscatedSignUp('[]')).toBe(false);
    expect(obfuscatedSignUp(0)).toBe(false);
  });
});

describe('fixedOnForm', () => {
  it('walks back for what a field can fix', () => {
    for (const fail of ['email_taken', 'bad_email', 'weak_password', 'bad_input']) {
      expect(fixedOnForm(fail)).toBe(true);
    }
  });

  it('stays put for what no field can fix', () => {
    for (const fail of ['rate_limit', 'offline', 'credentials', 'need_email', '']) {
      expect(fixedOnForm(fail)).toBe(false);
    }
  });
});
