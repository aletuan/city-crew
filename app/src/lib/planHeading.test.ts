import { describe, expect, it } from 'vitest';
import type { Lang } from './lang';
import { planTitle, planWhen, type PlanHeadingInput } from './planHeading';

const tFor = (lang: Lang) => (en: string, vi: string, ja: string, zh: string, hant: string) =>
  ({ en, vi, ja, zh, 'zh-Hant': hant })[lang];
const vi = tFor('vi');
const ask = (over: Partial<PlanHeadingInput> = {}): PlanHeadingInput => ({
  company: null, categories: [], when: 'evening', where: null, city: 'Hà Nội', ...over,
});
// Read with plain spaces; how the phrases hold together has its own test.
const title = (over: Partial<PlanHeadingInput>, lang: Lang = 'vi') =>
  planTitle(ask(over), lang, tFor(lang)).replace(/\u00A0/g, ' ');

describe('planTitle', () => {
  // The owner's shape: what, where, with whom (12 Nov 2026).
  it('reads the request back as one sentence: what, where, with whom', () => {
    expect(title({ categories: ['eats'], where: 'Tây Hồ', whereKind: 'district', company: 'friends' }))
      .toBe('Ăn tối ở Tây Hồ cùng hội bạn');
    expect(title({ categories: ['cafes'], whereKind: 'near', company: 'couple' }))
      .toBe('Cà phê gần bạn cùng người ấy');
  });

  it('names one clear kind of place, and calls a mix or none going out', () => {
    expect(title({ categories: ['eats'], when: 'day' })).toBe('Ăn uống ở Hà Nội');
    expect(title({ categories: ['nightlife'] })).toBe('Đi chơi đêm ở Hà Nội');
    expect(title({ categories: ['cafes', 'eats'] })).toBe('Đi chơi ở Hà Nội');
    expect(title({ categories: ['views'] })).toBe('Đi chơi ở Hà Nội');
  });

  it('says each kind of start the wizard can give', () => {
    expect(title({ where: 'Hồ Gươm', whereKind: 'place' })).toBe('Đi chơi gần Hồ Gươm');
    expect(title({ where: 'Ghim bạn đã thả', whereKind: 'pin' })).toBe('Đi chơi gần điểm ghim');
    expect(title({ where: 'Hà Nội · Trung tâm', whereKind: 'city' })).toBe('Đi chơi ở Hà Nội');
    expect(title({ whereKind: 'city', city: null })).toBe('Đi chơi');
  });

  // A plan reached without the wizard's kind: a district is a district,
  // no words is the city, and words it cannot place are left out rather
  // than guessed at.
  it('falls back on the words alone when the kind is missing', () => {
    expect(title({ where: 'Old Quarter', district: 'hoan-kiem' })).toBe('Đi chơi ở Old Quarter');
    expect(title({ where: null })).toBe('Đi chơi ở Hà Nội');
    expect(title({ where: 'Hà Nội · Gần bạn' })).toBe('Đi chơi');
    expect(title({ whereKind: 'district', where: null })).toBe('Đi chơi');
  });

  it('names each company, and nobody when nobody was chosen', () => {
    expect(title({ company: 'solo' })).toBe('Đi chơi ở Hà Nội một mình');
    expect(title({ company: 'family' })).toBe('Đi chơi ở Hà Nội cùng cả nhà');
    expect(title({ company: 'someone-new' })).toBe('Đi chơi ở Hà Nội');
  });

  // A long title breaks between phrases, never inside one.
  it('holds each phrase together, so a line breaks only between them', () => {
    const raw = planTitle(ask({ categories: ['cafes'], whereKind: 'near', company: 'couple' }), 'vi', vi);
    expect(raw.split(' ')).toEqual(['Cà\u00A0phê', 'gần\u00A0bạn', 'cùng\u00A0người\u00A0ấy']);
  });

  it('puts the words in each language’s own order', () => {
    const a = { categories: ['eats'], where: 'Tây Hồ', whereKind: 'district' as const, company: 'friends' };
    expect(title(a, 'en')).toBe('Dinner in Tây Hồ with friends');
    expect(title(a, 'ja')).toBe('Tây Hồで友だちとディナー');
    expect(title(a, 'zh')).toBe('和朋友在Tây Hồ吃晚餐');
    expect(title(a, 'zh-Hant')).toBe('和朋友在Tây Hồ吃晚餐');
  });
});

describe('planWhen', () => {
  const T = '2026-11-12';
  const M = '2026-11-13';
  it('says tonight and tomorrow in words', () => {
    expect(planWhen(T, T, M, 'evening', 'Thứ 5, 12/11', vi)).toBe('Tối nay');
    expect(planWhen(T, T, M, 'day', 'Thứ 5, 12/11', vi)).toBe('Hôm nay');
    expect(planWhen(M, T, M, 'evening', 'Thứ 6, 13/11', vi)).toBe('Tối mai');
    expect(planWhen(M, T, M, 'day', 'Thứ 6, 13/11', vi)).toBe('Ngày mai');
  });

  it('gives the date and the half of it further off', () => {
    expect(planWhen('2026-11-15', T, M, 'evening', 'Thứ 7, 15/11', vi)).toBe('Thứ 7, 15/11 · buổi tối');
    expect(planWhen('2026-11-15', T, M, 'day', 'Thứ 7, 15/11', vi)).toBe('Thứ 7, 15/11 · cả ngày');
  });
});
