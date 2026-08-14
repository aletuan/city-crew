import { describe, expect, it } from 'vitest';
import { handleProblem, normalizeHandle, suggestHandle } from './handle';

describe('normalizeHandle', () => {
  it('lowercases and trims', () => {
    expect(normalizeHandle('  AnhLT  ')).toBe('anhlt');
  });

  // Typed out of habit from every other app, and not part of the value.
  it('drops the @ people type in front', () => {
    expect(normalizeHandle('@anhlt')).toBe('anhlt');
    expect(normalizeHandle('@@anhlt')).toBe('anhlt');
  });
});

describe('handleProblem', () => {
  it('passes a handle the database would accept', () => {
    expect(handleProblem('anhlt')).toBeNull();
    expect(handleProblem('a_1')).toBeNull();
    expect(handleProblem('a'.repeat(20))).toBeNull();
  });

  // Separate reasons, because "too short" is an instruction where
  // "3–20 characters, letters, numbers and underscores" is a rule to decode.
  it('names what is wrong rather than just refusing', () => {
    expect(handleProblem('')).toBe('empty');
    expect(handleProblem('  ')).toBe('empty');
    expect(handleProblem('ab')).toBe('short');
    expect(handleProblem('a'.repeat(21))).toBe('long');
    expect(handleProblem('anh lt')).toBe('chars');
    expect(handleProblem('anh-lt')).toBe('chars');
    expect(handleProblem('anhlt!')).toBe('chars');
  });

  // The case check runs after normalising, so shouting is not an error.
  it('accepts a handle typed in capitals', () => {
    expect(handleProblem('ANHLT')).toBeNull();
  });
});

describe('suggestHandle', () => {
  it('makes a handle out of a name', () => {
    expect(suggestHandle('Tuan Anh Le')).toBe('tuananhle');
  });

  // Vietnamese names are the common case here, so the diacritics have to
  // come off rather than the name being rejected.
  it('strips Vietnamese diacritics rather than giving up', () => {
    expect(suggestHandle('Nguyễn Minh Anh')).toBe('nguyenminhanh');
    expect(suggestHandle('Đặng Thu Hà')).toBe('dangthuha');
  });

  it('trims to the maximum length', () => {
    expect(suggestHandle('a'.repeat(40))).toHaveLength(20);
  });

  // An empty box is better than a handle made of nothing: a name in a
  // script with no ASCII in it leaves the person to choose for themselves.
  it('gives nothing rather than a meaningless handle', () => {
    expect(suggestHandle('田中太郎')).toBe('');
    expect(suggestHandle('')).toBe('');
    expect(suggestHandle('Al')).toBe('');
  });
});
