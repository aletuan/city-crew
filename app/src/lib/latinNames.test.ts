// What `write-blurb` holds a Chinese draft to: the names the blurb
// carries, each written as the owner's rule says. Tested from here for the reason `ward.test.ts` gives — the
// module runs in an Edge Function and is plain TypeScript, and this is
// where the test runner lives. Every case is a blurb from the catalog,
// or the shape of one (21 Oct 2026).

import { describe, expect, it } from 'vitest';
import { toHantCatalog } from '../../scripts/hant';
import { EXONYMS, chineseNames, latinNames, namesLost } from '../../../supabase/functions/_shared/latinNames';

describe('latinNames', () => {
  it('reads streets, districts, lakes and cities as the blurb spells them', () => {
    expect(latinNames('A fine bar at 43 Nguyễn Huệ, near Hoàn Kiếm Lake in Hanoi.'))
      .toEqual(['Nguyễn Huệ', 'Hoàn Kiếm Lake', 'Hanoi']);
    expect(latinNames('A beachside cafe in Long Hai, with windows onto the sea.')).toEqual(['Long Hai']);
  });

  // An is an article and a Vietnamese word: Hội An and An Hải are names.
  it('keeps An inside a name, and drops it as an article', () => {
    expect(latinNames('A small Japanese place on Phan Huy Chú in An Hải, near Hội An.'))
      .toEqual(['Phan Huy Chú', 'An Hải', 'Hội An']);
    expect(latinNames('Later, a walk by the Han River.')).toEqual(['Han River']);
    expect(latinNames('Dinner at The Nest.')).toEqual(['Nest']);
  });

  it('skips a sentence\'s first word, capitalised by where it stands, in either language', () => {
    expect(latinNames('Wooden tables. Benches by the water.')).toEqual([]);
    expect(latinNames('Ghế đá trên Nguyễn Huệ.')).toEqual(['Nguyễn Huệ']);
    expect(latinNames('Đà Lạt in the rain.')).toEqual(['Đà Lạt']);
    expect(latinNames('Near Saigon River; Hội An at dusk.')).toEqual(['Saigon River', 'Hội An']);
  });

  it('leaves out what Chinese translates: nationalities, styles, titles, numbers', () => {
    expect(latinNames('Imposing 1800s Gothic Revival cathedral, with French doors and DJs on the 81st floor.')).toEqual([]);
    expect(latinNames('Fillings, Hanoi-style, in a Huế-style bowl.')).toEqual(['Hanoi', 'Huế']);
    expect(latinNames('The stilt house of President Ho Chi Minh, by Ba Dinh Square.')).toEqual(['Ba Dinh Square']);
    expect(latinNames('A Hong Kong-style tea house, and a Nagoya grill.')).toEqual(['Hong Kong', 'Nagoya']);
    expect(latinNames('Lunch at a Hanoi Italian place, or at The.')).toEqual(['Hanoi']);
  });

  it('ends a name at a possessive, a comma or a quotation mark', () => {
    expect(latinNames("A cafe at LAPH's Vỹ Dạ branch.")).toEqual(['LAPH', 'Vỹ Dạ']);
    expect(latinNames('Bartender Phạm Tiến Tiệp’s "Phở" was born here, in Lane 4 Ao Sen.'))
      .toEqual(['Phạm Tiến Tiệp', 'Phở', 'Ao Sen']);
  });

  it('names each name once', () => {
    expect(latinNames('Benches by Saigon River, and boats on Saigon River.')).toEqual(['Saigon River']);
  });
});

// The rule's two halves: a city or landmark the table lists takes its
// Chinese name, and every other name keeps the blurb's Latin.
describe('chineseNames', () => {
  it('gives a city and a landmark their Chinese name, and a street its Latin', () => {
    expect(chineseNames('Benches on Nguyễn Huệ by Hoàn Kiếm Lake, in Hanoi.', 'zh')).toEqual([
      { name: 'Nguyễn Huệ', forms: ['Nguyễn Huệ'] },
      { name: 'Hoàn Kiếm Lake', forms: ['还剑湖'] },
      { name: 'Hanoi', forms: ['河内'] },
    ]);
  });

  it('writes Taiwan\'s names in Traditional', () => {
    expect(chineseNames('A Bali-style bar in Hanoi.', 'zh-Hant').map((n) => n.forms[0])).toEqual(['峇里島', '河內']);
  });

  // A bakery whose blurb opens with its own name, "Coco Paris".
  it('asks for a word of the place\'s own name as the place spells it, and takes either form', () => {
    expect(chineseNames('Coco Paris is a small bakery.', 'zh', ['Coco Paris'])).toEqual([{ name: 'Paris', forms: ['Paris', '巴黎'] }]);
    expect(chineseNames('Coco Paris is a small bakery.', 'zh')).toEqual([{ name: 'Paris', forms: ['巴黎'] }]);
    expect(namesLost('The museum tells Hanoi\'s story.', '博物馆讲述河内的历史。', 'zh', ['Hanoi Museum'])).toEqual([]);
    expect(chineseNames('Benches on Nguyễn Huệ.', 'zh', ['Nguyễn Huệ Walking Street'])).toEqual([{ name: 'Nguyễn Huệ', forms: ['Nguyễn Huệ'] }]);
  });

  // A hotel named for its city is a name of its own.
  it('matches a name only whole', () => {
    expect(chineseNames('Rooftop of the Fairmont Hanoi.', 'zh')).toEqual([{ name: 'Fairmont Hanoi', forms: ['Fairmont Hanoi'] }]);
  });
});

describe('EXONYMS', () => {
  // A spelling the reader cannot see as one name is a row that never
  // matches: a hyphen ends a word, a lowercase "of" ends a run.
  it('lists only spellings the blurb\'s reading sees whole, each once', () => {
    const all = EXONYMS.flatMap((e) => e.latin);
    for (const v of all) expect(latinNames(`Near ${v}.`)).toEqual([v]);
    expect(new Set(all).size).toBe(all.length);
  });

  it('writes the Traditional the converter writes, Taiwan\'s names included', () => {
    // Taiwan may have a second spelling the mainland has not (台北 beside the official 臺北).
    for (const e of EXONYMS) expect(e.zh.map(toHantCatalog)).toEqual(e.hant.slice(0, e.zh.length));
  });
});

describe('namesLost', () => {
  it('lists the names a translation wrote against the rule, as they should read', () => {
    expect(namesLost('Benches on Nguyễn Huệ, by Hoàn Kiếm Lake.', '阮惠街上的长椅，靠近 Hoàn Kiếm Lake。', 'zh'))
      .toEqual(['Nguyễn Huệ', '还剑湖']);
    expect(namesLost('Benches on Nguyễn Huệ, by Hoàn Kiếm Lake.', 'Nguyễn Huệ 上的长椅，靠近还剑湖。', 'zh')).toEqual([]);
    expect(namesLost('A cafe in Long Hai.', '位于Long Hai的海边咖啡馆。', 'zh')).toEqual([]);
  });

  it('takes any of a name\'s forms, and reads each script\'s own', () => {
    expect(namesLost('A house in the Old Quarter.', '会安古城里的老宅。', 'zh')).toEqual([]);
    expect(namesLost('A bar in Hanoi.', '河内的酒吧。', 'zh-Hant')).toEqual(['河內']);
  });

  it('reads a translation\'s possessive as the name', () => {
    expect(latinNames("Near St Joseph's Cathedral.")).toEqual(['Joseph', 'Cathedral']);
    expect(namesLost("Near St Joseph's Cathedral.", '可遠眺St Joseph\'s Cathedral。', 'zh-Hant')).toEqual([]);
  });
});
