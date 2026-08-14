import { describe, expect, it } from 'vitest';
import { cleanOtp, OTP_MAX } from './otp';

describe('cleanOtp', () => {
  it('leaves a plain code alone', () => {
    expect(cleanOtp('907565')).toBe('907565');
  });

  // The bug this exists for: the project issues eight digits, and a field
  // that stopped at six turned a correct code into "expired or invalid".
  it('keeps a code longer than the six-digit default', () => {
    expect(cleanOtp('90756563')).toBe('90756563');
  });

  it('accepts the longest code Supabase will issue', () => {
    const ten = '1234567890';
    expect(ten).toHaveLength(OTP_MAX);
    expect(cleanOtp(ten)).toBe(ten);
  });

  it('drops the spacing a copy from the email can bring along', () => {
    expect(cleanOtp('907 565 63')).toBe('90756563');
    expect(cleanOtp(' 907565\n')).toBe('907565');
  });

  it('drops anything that is not a digit', () => {
    expect(cleanOtp('9O7565')).toBe('97565');
  });

  // Better a code that fails on the server than one that overruns the
  // field and pushes the real digits out of view.
  it('refuses to grow past the longest code', () => {
    expect(cleanOtp('123456789012')).toBe('1234567890');
  });

  it('has nothing to say about nothing', () => {
    expect(cleanOtp('')).toBe('');
    expect(cleanOtp('abc')).toBe('');
  });
});
