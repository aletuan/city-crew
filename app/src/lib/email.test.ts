import { describe, expect, it } from 'vitest';
import { afterEmailEdit, cleanEmail, emailShapeOk } from './email';

describe('cleanEmail', () => {
  // The incident, verbatim: the iOS keyboard's space after an
  // autocomplete, in the middle of the address where no trim reaches.
  it('removes the space the keyboard slips in after the @', () => {
    expect(cleanEmail('ngotiennam@ gmail.com')).toBe('ngotiennam@gmail.com');
  });

  it('removes whitespace wherever it is, whatever it is', () => {
    expect(cleanEmail(' a@b.co ')).toBe('a@b.co');
    expect(cleanEmail('a @b.co')).toBe('a@b.co');
    expect(cleanEmail('a@b\t.co\n')).toBe('a@b.co');
  });

  it('leaves a clean address exactly as it was', () => {
    expect(cleanEmail('ngo.tien+nam@sub.gmail.com')).toBe('ngo.tien+nam@sub.gmail.com');
    expect(cleanEmail('')).toBe('');
  });
});

describe('emailShapeOk', () => {
  it('accepts ordinary addresses', () => {
    expect(emailShapeOk('a@b.co')).toBe(true);
    expect(emailShapeOk('ngotiennam@gmail.com')).toBe(true);
    expect(emailShapeOk('ngo.tien+nam@sub.gmail.com')).toBe(true);
  });

  // Loose on purpose: the module comment promises the server decides,
  // so a short but conceivable address passes rather than being argued
  // with here.
  it('accepts the odd but conceivable', () => {
    expect(emailShapeOk('a@b.c')).toBe(true);
  });

  it('refuses what can never be right', () => {
    expect(emailShapeOk('')).toBe(false);
    expect(emailShapeOk('abc')).toBe(false);            // no @
    expect(emailShapeOk('a@b')).toBe(false);            // no dot after it
    expect(emailShapeOk('a@b.')).toBe(false);           // dot with nothing after
    expect(emailShapeOk('a@.co')).toBe(false);          // dot with nothing before
    expect(emailShapeOk('@b.co')).toBe(false);          // nothing before the @
    expect(emailShapeOk('a@@b.co')).toBe(false);        // two of them
    expect(emailShapeOk('a b@c.co')).toBe(false);       // whitespace
    expect(emailShapeOk('ngotiennam@ gmail.com')).toBe(false); // the incident, unstripped
  });
});

describe('afterEmailEdit', () => {
  it('clears "enter your email" once there is anything in the field, and not before', () => {
    expect(afterEmailEdit('need_email', 'q')).toBeNull();
    expect(afterEmailEdit('need_email', '')).toBe('need_email');
  });

  it('clears "not an address" only once the address is shaped like one', () => {
    expect(afterEmailEdit('bad_email', 'qa@example')).toBe('bad_email');
    expect(afterEmailEdit('bad_email', 'qa@example.com')).toBeNull();
  });

  it('clears "already taken" on any edit — it was about another address', () => {
    expect(afterEmailEdit('email_taken', 'qa@example.co')).toBeNull();
  });

  it('leaves every other error, and no error, as it was', () => {
    expect(afterEmailEdit('need_password', 'qa@example.com')).toBe('need_password');
    expect(afterEmailEdit('need_name', 'qa@example.com')).toBe('need_name');
    expect(afterEmailEdit(null, 'qa@example.com')).toBeNull();
  });
});
