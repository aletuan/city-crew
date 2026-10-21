// What `write-blurb` holds a Chinese draft to: the Latin names the blurb
// carries. Tested from here for the reason `ward.test.ts` gives — the
// module runs in an Edge Function and is plain TypeScript, and this is
// where the test runner lives. Every case is a blurb from the catalog,
// or the shape of one (21 Oct 2026).

import { describe, expect, it } from 'vitest';
import { latinNames, namesLost } from '../../../supabase/functions/_shared/latinNames';

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
    expect(latinNames('A Hong Kong-style tea house, and a Nagoya grill.')).toEqual([]);
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

describe('namesLost', () => {
  it('lists the names a translation dropped, and nothing it kept', () => {
    expect(namesLost('Benches on Nguyễn Huệ, by Hoàn Kiếm Lake.', '阮惠街上的长椅，靠近 Hoàn Kiếm Lake。'))
      .toEqual(['Nguyễn Huệ']);
    expect(namesLost('A cafe in Long Hai.', '位于Long Hai的海边咖啡馆。')).toEqual([]);
  });

  it('reads a translation\'s possessive as the name', () => {
    expect(latinNames("Near St Joseph's Cathedral.")).toEqual(['Joseph', 'Cathedral']);
    expect(namesLost("Near St Joseph's Cathedral.", '可遠眺St Joseph\'s Cathedral。')).toEqual([]);
  });
});
