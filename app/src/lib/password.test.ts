import { describe, expect, it } from 'vitest';
import { passwordStrength } from './password';

describe('passwordStrength', () => {
  it('has no opinion about an empty field', () => {
    expect(passwordStrength('')).toBe(0);
  });

  // Variety cannot buy back length: four character classes in seven
  // characters is still under the only rule that is actually enforced,
  // and a meter that read Fair there would be contradicted at submit.
  it('calls anything under the minimum weak, however varied', () => {
    expect(passwordStrength('aB3!xyz')).toBe(1);
  });

  describe('the classics stay weak no matter how they are dressed', () => {
    it('catches the base word in any case', () => {
      expect(passwordStrength('password')).toBe(1);
      expect(passwordStrength('PASSWORD')).toBe(1);
    });

    // The three standard disguises, then all of them at once. Each lands
    // on the same list entry because the lookup normalises rather than
    // the list enumerating.
    it('sees through suffix digits', () => {
      expect(passwordStrength('Password123')).toBe(1);
      expect(passwordStrength('iloveyou2024')).toBe(1);
    });

    it('sees through l33t spelling', () => {
      expect(passwordStrength('P@ssw0rd')).toBe(1);
    });

    it('sees through both at once', () => {
      expect(passwordStrength('P4ssw0rd2024')).toBe(1);
    });

    // Stored with its digit, because the digit is the password.
    it('knows trustno1 literally', () => {
      expect(passwordStrength('trustno1')).toBe(1);
    });

    // The first thing anyone guessing at this app in particular would try.
    it('includes the app itself', () => {
      expect(passwordStrength('citycrew1')).toBe(1);
    });
  });

  describe('patterns a hand produces without a thought', () => {
    it('catches a short block repeated to fill the box', () => {
      expect(passwordStrength('aaaaaaaa')).toBe(1);
      expect(passwordStrength('abcdabcdabcd')).toBe(1);
    });

    it('catches straight runs in either direction', () => {
      expect(passwordStrength('abcdefgh')).toBe(1);
      expect(passwordStrength('9876543210')).toBe(1);
    });

    it('catches a keyboard row swept forward or backward', () => {
      expect(passwordStrength('qwertyuio')).toBe(1);
      expect(passwordStrength('poiuytrew')).toBe(1);
    });
  });

  it('calls the bare minimum fair', () => {
    expect(passwordStrength('kittensz')).toBe(2);
    // A digit helps, but at eleven characters not enough to change grade.
    expect(passwordStrength('kittens1234')).toBe(2);
  });

  // The two roads to Good: the same password grown one character past
  // twelve, or full variety at the minimum length.
  it('grades up on length or on variety', () => {
    expect(passwordStrength('kittens12345')).toBe(3);
    expect(passwordStrength('aB3!efgh')).toBe(3);
    expect(passwordStrength('correcthorsebatt')).toBe(3);
  });

  it('calls length with any variety at all strong', () => {
    expect(passwordStrength('Tr0ub4dor&3x')).toBe(4);
    // The xkcd passphrase: Strong on length and its spaces alone,
    // which is the NIST posture the module header commits to.
    expect(passwordStrength('correct horse battery staple')).toBe(4);
  });

  // Documented in the scorer: a single-class string stops at Good even
  // past twenty characters, because nothing here can tell a passphrase
  // from held-down keys. One space or capital is the difference.
  it('will not call a single class strong on length alone', () => {
    expect(passwordStrength('correcthorsebatterystaple')).toBe(3);
  });
});
