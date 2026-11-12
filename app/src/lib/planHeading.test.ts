import { describe, expect, it } from 'vitest';
import type { Lang } from './lang';
import { planSub, planTitle, type PlanDay, type PlanHeadingInput } from './planHeading';

const tFor = (lang: Lang) => (en: string, vi: string, ja: string, zh: string, hant: string) =>
  ({ en, vi, ja, zh, 'zh-Hant': hant })[lang];
const vi = tFor('vi');
// Thursday 12 November 2026.
const TODAY = '2026-11-12';
const on = (day: string, dateline = 'X'): PlanDay => ({ day, today: TODAY, tomorrow: '2026-11-13', dateline });
const ask = (over: Partial<PlanHeadingInput> = {}): PlanHeadingInput => ({
  company: null, categories: [], when: 'evening', where: null, city: 'Hà Nội', ...over,
});
// Read with plain spaces; how the phrases hold together has its own test.
const title = (over: Partial<PlanHeadingInput>, d: PlanDay = on(TODAY), lang: Lang = 'vi') =>
  planTitle(ask(over), d, lang, tFor(lang)).replace(/ /g, ' ');

describe('planTitle: what, and when', () => {
  // The owner's shape (12 Nov 2026): what + when as the title.
  it('names the outing and the evening', () => {
    expect(title({ categories: ['cafes'] })).toBe('Cà phê tối nay');
    expect(title({ categories: ['cafes'] }, on('2026-11-13'))).toBe('Cà phê tối mai');
    expect(title({ categories: ['cafes'] }, on('2026-11-14'))).toBe('Cà phê tối thứ Bảy');
  });

  // "Ăn tối tối nay" says the evening twice.
  it('does not say the evening twice when the outing already does', () => {
    expect(title({ categories: ['eats'] })).toBe('Ăn tối hôm nay');
    expect(title({ categories: ['eats'] }, on('2026-11-13'))).toBe('Ăn tối ngày mai');
    expect(title({ categories: ['nightlife'] }, on('2026-11-15'))).toBe('Đi chơi đêm Chủ nhật');
  });

  it('says a day as a day', () => {
    expect(title({ when: 'day', categories: ['eats'] })).toBe('Ăn uống hôm nay');
    expect(title({ when: 'day' }, on('2026-11-13'))).toBe('Đi chơi ngày mai');
    expect(title({ when: 'day' }, on('2026-11-18'))).toBe('Đi chơi thứ Tư');
  });

  it('names two kinds together, and calls more, none or an unknown one going out', () => {
    expect(title({ categories: ['cafes', 'nightlife'] })).toBe('Cà phê & về đêm tối nay');
    expect(title({ categories: ['cafes', 'nightlife', 'eats'] })).toBe('Đi chơi tối nay');
    expect(title({ categories: [] })).toBe('Đi chơi tối nay');
    expect(title({ categories: ['views'] })).toBe('Đi chơi tối nay');
    expect(title({ categories: ['cafes', 'somewhere-new'] })).toBe('Đi chơi tối nay');
  });

  // Past a week a weekday no longer says which day; the date does.
  it('gives the date past a week, or for a day it cannot read', () => {
    expect(title({ categories: ['cafes'] }, on('2026-11-25', 'Thứ 4, 25/11'))).toBe('Cà phê · Thứ 4, 25/11');
    expect(title({ categories: ['cafes'] }, on('someday', 'Thứ 5, 12/11'))).toBe('Cà phê · Thứ 5, 12/11');
  });

  it('holds each phrase together, so a line breaks only between them', () => {
    const raw = planTitle(ask({ categories: ['cafes', 'nightlife'] }), on(TODAY), 'vi', vi);
    expect(raw.split(' ')).toEqual(['Cà phê & về đêm', 'tối nay']);
  });

  it('puts the words in each language’s own order', () => {
    const a = { categories: ['eats'] };
    expect(title(a, on(TODAY), 'en')).toBe('Dinner tonight');
    expect(title({ categories: ['cafes'] }, on('2026-11-14'), 'en')).toBe('Coffee on Saturday evening');
    expect(title({ when: 'day' }, on('2026-11-14'), 'en')).toBe('Going out on Saturday');
    expect(title({ categories: ['cafes', 'eats'] }, on(TODAY), 'en')).toBe('Cafés & eats tonight');
    expect(title(a, on(TODAY), 'ja')).toBe('今夜のディナー');
    expect(title({ categories: ['cafes', 'eats'] }, on(TODAY), 'ja')).toBe('今夜のカフェと食事');
    expect(title(a, on(TODAY), 'zh')).toBe('今晚吃晚餐');
    expect(title({ categories: ['cafes', 'eats'] }, on('2026-11-13'), 'zh-Hant')).toBe('明晚咖啡館和美食');
    expect(title({ categories: ['cafes'] }, on('2026-11-25', '11月25日'), 'ja')).toBe('11月25日のカフェ');
    expect(title({ categories: ['cafes'] }, on('2026-11-25', '11月25日'), 'zh')).toBe('11月25日喝咖啡');
  });
});

describe('planSub: with whom, and where', () => {
  const sub = (over: Partial<PlanHeadingInput>, lang: Lang = 'vi') => planSub(ask(over), tFor(lang));

  it('names who is going, then where it starts', () => {
    expect(sub({ company: 'couple', whereKind: 'near' })).toBe('Cùng người ấy · gần bạn');
    expect(sub({ company: 'friends', where: 'Tây Hồ', whereKind: 'district' })).toBe('Cùng hội bạn · Tây Hồ');
    expect(sub({ company: 'family', whereKind: 'city' })).toBe('Cùng cả nhà · Hà Nội');
    expect(sub({ company: 'solo', where: 'Hồ Gươm', whereKind: 'place' })).toBe('Một mình · gần Hồ Gươm');
    expect(sub({ whereKind: 'pin' })).toBe('Gần điểm ghim');
  });

  it('draws no line when there is nothing to say', () => {
    expect(sub({ company: 'someone-new', whereKind: 'city', city: null })).toBeNull();
  });

  // A plan reached without the wizard's kind: a district is a district,
  // no words is the city, and words it cannot place are left out.
  it('falls back on the words alone when the kind is missing', () => {
    expect(sub({ where: 'Old Quarter', district: 'hoan-kiem' })).toBe('Old Quarter');
    expect(sub({ where: null })).toBe('Hà Nội');
    expect(sub({ where: 'Hà Nội · Gần bạn' })).toBeNull();
    expect(sub({ whereKind: 'district', where: null })).toBeNull();
    expect(sub({ whereKind: 'place', where: null })).toBeNull();
  });

  it('speaks each language', () => {
    expect(sub({ company: 'couple', whereKind: 'near' }, 'en')).toBe('For two · near you');
    expect(sub({ company: 'friends', whereKind: 'near' }, 'ja')).toBe('友だちと · 近く');
  });
});
