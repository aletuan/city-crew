// What a photograph shows, as the sheet may say it.

import { describe, expect, it } from 'vitest';
import { KIND_ICON, KINDS, bothSources, kindName, kindNoun, kindOf } from './photoKind';

const en = (e: string) => e;
const vi = (_e: string, v: string) => v;
const ja = (_e: string, _v: string, j: string) => j;

describe('kindOf', () => {
  it('is the labels\' kind when they are sure of it', () => {
    for (const k of KINDS) expect(kindOf({ kind: k, wide: true })).toBe(k);
    expect(kindOf({ kind: 'food', unsure: false })).toBe('food');
  });
  // Unsure is the model not betting on it. Other is said like any kind.
  it('is nothing when unsure, unknown, or not labelled', () => {
    expect(kindOf({ kind: 'food', unsure: true })).toBeNull();
    expect(kindOf({ kind: 'other', unsure: true })).toBeNull();
    expect(kindOf({ kind: 'selfie' })).toBeNull();
    expect(kindOf({})).toBeNull();
    expect(kindOf(null)).toBeNull();
    expect(kindOf(undefined)).toBeNull();
    expect(kindOf('food')).toBeNull();
  });
});

describe('the words', () => {
  it('names every kind in the three languages, with its own mark', () => {
    expect(KINDS.map((k) => kindName(k, en))).toEqual(['Food & drink', 'Inside', 'Front', 'Garden & terrace', 'Culture', 'View', 'Menu & signs', 'Collage', 'Other']);
    expect(KINDS.map((k) => kindName(k, vi))).toEqual(['Đồ ăn & uống', 'Nội thất', 'Mặt tiền', 'Sân vườn', 'Văn hóa', 'Cảnh', 'Chữ, menu', 'Ảnh ghép', 'Khác']);
    expect(KINDS.map((k) => kindName(k, ja))).toEqual(['料理・ドリンク', '店内', '外観', '庭・テラス', '文化', '景色', 'メニュー・文字', 'コラージュ', 'その他']);
    expect(new Set(KINDS.map((k) => KIND_ICON[k])).size).toBe(KINDS.length);
  });
  it('says each kind as it sits inside a sentence', () => {
    expect(KINDS.map((k) => kindNoun(k, en))).toEqual(['food and drink', 'interior', 'storefront', 'garden and terrace', 'culture', 'view', 'menu and sign', 'collage', 'other']);
    expect(KINDS.map((k) => kindNoun(k, vi))).toEqual(['đồ ăn & uống', 'nội thất', 'mặt tiền', 'sân vườn', 'văn hóa', 'cảnh', 'chữ, menu', 'ảnh ghép', 'khác']);
    expect(KINDS.map((k) => kindNoun(k, ja))).toEqual(['料理・ドリンク', '店内', '外観', '庭・テラス', '文化', '景色', 'メニュー・文字', 'コラージュ', 'その他']);
  });
  it('names both readers once a kind is shown', () => {
    expect(bothSources(vi)).toBe('Phân tích ảnh bằng Apple Vision và Claude.');
    expect(bothSources(en)).toBe('Photo analysed by Apple Vision and Claude.');
    expect(bothSources(ja)).toBe('Apple VisionとClaudeで写真を分析。');
  });
});
