// How a Chinese translation writes the names a blurb carries.
//
// The owner's rule, as it stands since the evening of 21 Oct 2026, is two
// halves. A city, and a landmark that has a Chinese name of its own,
// takes that name: 河内, 胡志明市, 还剑湖, 墨尔本 — what every Chinese map,
// booking app and guidebook prints, so that a Latin "Hanoi" in a Chinese
// sentence reads as a word nobody translated. Everything else keeps the
// blurb's own Latin spelling: a street, a ward, a building, a venue —
// Nguyễn Huệ, not 阮惠街 — because that is the sign, the map pin and what
// the driver is shown, and a Hán-Việt reading of a street matches none
// of them. `EXONYMS` is the first half; a name it does not list is the
// second.
//
// The rule was all Latin that morning, and was checked as all Latin: of
// 257 Simplified blurbs, 68 had dropped a Latin name the English carried,
// and re-translated under the check they kept them. Asked the same day
// how other apps write these names, and shown the answer above, the
// owner moved the cities and landmarks over. So the check stayed and its
// table grew; what it reads off the English did not change.
//
// What counts as a name is read off the English: a run of capitalised
// words. Most of the work is what does not count, and every exception
// below was found in those 257 blurbs —
//
// - The first word of a sentence, capitalised by where it stands: alone
//   ("Wooden tables…"), or plain in front of a name ("Bartender Phạm
//   Tiến Tiệp…"). Marks do not make a lone first word a name: when a
//   blurb has no English the Vietnamese is the source, and "Ghế đá…"
//   opens with a bench.
// - Nationalities, styles and titles, which Chinese translates and should
//   (Vietnamese, Gothic, Art Deco, President); and a street word on its
//   own (Lane 6 is an address whose name is the part after it).
// - Numbers, ordinals and decades, which Chinese writes its own way
//   (81st → 81 层, District 1 → the number kept, the order changed).
// - A possessive, which ends a name ("LAPH's Vỹ Dạ branch" is two).
// - "-style" and the like: Hanoi-style is Hanoi.
// - People, whom Chinese writes in its own characters (胡志明).
//
// A name matches the table only whole: "Fairmont Hanoi" and "Little
// Hanoi" are a hotel and a restaurant, and keep their Latin, while
// "Hanoi" alone is 河内. Plain TypeScript, no Deno APIs, so the app's test
// runner can hold it to that (`app/src/lib/latinNames.test.ts`).

/**
 * Words that open a sentence or a name in English and are not part of
 * the name: "The Nest" is kept if "Nest" is. Only at the front, and only
 * before a plain word — An is also Vietnamese, and "An Hải" and "Hội An"
 * are names whole.
 */
const OPENERS = new Set(['A', 'An', 'The', 'This', 'That', 'These', 'Those', 'It', 'Its', 'Each', 'Every', 'Some', 'One']);

/** Capitalised words Chinese translates, or that are not names alone. */
const NOT_NAMES = new Set([
  // Words that open a sentence capitalised.
  'Inside', 'Outside', 'Behind', 'Upstairs', 'Open', 'Small', 'Big', 'Tiny', 'Quiet', 'New',
  'Imposing', 'Grand', 'Remote', 'Landscaped', 'Upscale', 'Modern', 'Flamboyant', 'Orange', 'White',
  'Arched', 'Waffles', 'Orders', 'Mostly', 'Book', 'Alongside',
  // Nationalities, faiths, styles.
  'Vietnam', 'Vietnamese', 'French', 'Italian', 'Japanese', 'Korean', 'Chinese', 'Thai', 'Mexican',
  'Greek', 'Belgian', 'Australian', 'Australia', 'Asian', 'Mediterranean', 'European', 'Indian',
  'Spanish', 'American', 'English', 'German', 'Cantonese', 'Latin', 'Hanoians', 'Catholic', 'Buddhist',
  'Gothic', 'Revival', 'Victorian', 'Art', 'Deco', 'Confucian',
  // Acronyms a sentence uses as words.
  'DJ', 'DJs', 'LED', 'UNESCO', 'MiG', 'I',
  // Titles, and street words without their street.
  'President', 'Emperor', 'King', 'Queen', 'Lane', 'Alley', 'Level', 'Street', 'St', 'Road', 'Rd',
  'District', 'Ward',
  // Found when the table was built (21 Oct, all 435 blurbs): an adjective
  // and two words that open a clause.
  'Neapolitan', 'Hainanese', 'Half', 'No',
]);

/** People, whom Chinese writes in its own characters. */
const EXEMPT = new Set(['Ho Chi Minh', 'Gia Long', 'Gustave Eiffel', 'Nguyen', 'Tran']);

/**
 * The cities and landmarks with a Chinese name of their own: the
 * spellings a blurb gives them, and the forms a translation may write,
 * the first the one asked for. Traditional is Taiwan's — 峇里島 and 拿坡里,
 * not the mainland's names in Traditional characters — and every other
 * row is the Simplified put through the app's converter, which
 * `latinNames.test.ts` holds it to.
 *
 * Built from the names in all 435 blurbs on 21 Oct 2026: every city the
 * app covers, every landmark with a Chinese name a Chinese guide prints,
 * and the foreign places a blurb compares a place to. A landmark whose
 * Chinese name is not settled — the Hàn River is 韩江, 汉江 or 瀚江
 * depending on the guide — is left out, and so keeps its Latin.
 */
export const EXONYMS: readonly { latin: string[]; zh: string[]; hant: string[] }[] = [
  // The cities.
  { latin: ['Hanoi', 'Hà Nội', 'Ha Noi'], zh: ['河内'], hant: ['河內'] },
  { latin: ['Ho Chi Minh City', 'HCMC', 'Hồ Chí Minh City', 'TP.HCM'], zh: ['胡志明市'], hant: ['胡志明市'] },
  // In a Vietnamese blurb the city is "TP. Hồ Chí Minh", which the full
  // stop cuts in two; the man is 胡志明 too, so either is taken.
  { latin: ['Hồ Chí Minh'], zh: ['胡志明市', '胡志明'], hant: ['胡志明市', '胡志明'] },
  { latin: ['Saigon', 'Sài Gòn', 'Sai Gon'], zh: ['西贡', '胡志明市'], hant: ['西貢', '胡志明市'] },
  { latin: ['Da Nang', 'Đà Nẵng', 'Danang'], zh: ['岘港'], hant: ['峴港'] },
  { latin: ['Hội An', 'Hoi An'], zh: ['会安'], hant: ['會安'] },
  { latin: ['Huế', 'Hue'], zh: ['顺化'], hant: ['順化'] },
  { latin: ['Đà Lạt', 'Da Lat', 'Dalat'], zh: ['大叻'], hant: ['大叻'] },
  { latin: ['Vũng Tàu', 'Vung Tau'], zh: ['头顿'], hant: ['頭頓'] },
  { latin: ['Hải Phòng', 'Hai Phong', 'Haiphong'], zh: ['海防'], hant: ['海防'] },
  { latin: ['Ninh Bình', 'Ninh Binh'], zh: ['宁平'], hant: ['寧平'] },
  { latin: ['Nha Trang'], zh: ['芽庄'], hant: ['芽莊'] },
  { latin: ['Melbourne'], zh: ['墨尔本'], hant: ['墨爾本'] },
  // Landmarks. The Old Quarter is Hanoi's 老城区 and Hội An's 古城.
  { latin: ['Old Quarter'], zh: ['老城区', '老城', '古城', '古镇'], hant: ['老城區', '老城', '古城', '古鎮'] },
  { latin: ['Hoàn Kiếm Lake', 'Hồ Hoàn Kiếm', 'Hoan Kiem Lake', 'Sword Lake'], zh: ['还剑湖'], hant: ['還劍湖'] },
  { latin: ['West Lake', 'Hồ Tây', 'Ho Tay'], zh: ['西湖'], hant: ['西湖'] },
  { latin: ['Saigon River', 'Sông Sài Gòn'], zh: ['西贡河'], hant: ['西貢河'] },
  { latin: ['Red River', 'Sông Hồng'], zh: ['红河'], hant: ['紅河'] },
  { latin: ['Perfume River', 'Huong River', 'Hương River', 'Sông Hương'], zh: ['香江'], hant: ['香江'] },
  { latin: ['Dragon Bridge', 'Cầu Rồng'], zh: ['龙桥'], hant: ['龍橋'] },
  { latin: ['Long Biên Bridge', 'Long Bien Bridge', 'Cầu Long Biên'], zh: ['龙编桥'], hant: ['龍編橋'] },
  { latin: ['Ba Dinh Square', 'Ba Đình Square'], zh: ['巴亭广场'], hant: ['巴亭廣場'] },
  { latin: ['Van Mieu', 'Văn Miếu'], zh: ['文庙'], hant: ['文廟'] },
  { latin: ['Ngọc Sơn Temple', 'Đền Ngọc Sơn'], zh: ['玉山祠'], hant: ['玉山祠'] },
  { latin: ['Opera House'], zh: ['歌剧院', '大剧院'], hant: ['歌劇院', '大劇院'] },
  { latin: ['City Hall'], zh: ['市政厅'], hant: ['市政廳'] },
  { latin: ['Bến Thành Market', 'Ben Thanh Market'], zh: ['滨城市场'], hant: ['濱城市場'] },
  { latin: ['Đông Ba Market', 'Dong Ba Market'], zh: ['东巴市场'], hant: ['東巴市場'] },
  { latin: ['Marble Mountains', 'Ngũ Hành Sơn'], zh: ['五行山'], hant: ['五行山'] },
  { latin: ['Notre Dame'], zh: ['圣母院', '圣母大教堂'], hant: ['聖母院', '聖母大教堂'] },
  { latin: ['Ha Long Bay', 'Hạ Long Bay'], zh: ['下龙湾'], hant: ['下龍灣'] },
  { latin: ['Phú Quốc', 'Phu Quoc'], zh: ['富国岛'], hant: ['富國島'] },
  { latin: ['Mekong Delta'], zh: ['湄公河三角洲'], hant: ['湄公河三角洲'] },
  { latin: ['Mekong'], zh: ['湄公河'], hant: ['湄公河'] },
  { latin: ['Royal Exhibition Building'], zh: ['皇家展览馆'], hant: ['皇家展覽館'] },
  { latin: ['Melbourne Museum'], zh: ['墨尔本博物馆'], hant: ['墨爾本博物館'] },
  { latin: ['Port Phillip Bay'], zh: ['菲利普港湾'], hant: ['菲利普港灣'] },
  { latin: ['Victoria Market'], zh: ['维多利亚女王市场', '维多利亚市场'], hant: ['維多利亞女王市場', '維多利亞市場'] },
  // Elsewhere, as a blurb compares a place to it.
  { latin: ['Bangkok'], zh: ['曼谷'], hant: ['曼谷'] },
  { latin: ['Bali'], zh: ['巴厘岛', '巴厘'], hant: ['峇里島', '峇里'] },
  { latin: ['Paris'], zh: ['巴黎'], hant: ['巴黎'] },
  { latin: ['Europe'], zh: ['欧洲'], hant: ['歐洲'] },
  { latin: ['Naples', 'Napoli'], zh: ['那不勒斯'], hant: ['拿坡里'] },
  { latin: ['Shibuya'], zh: ['涩谷'], hant: ['澀谷'] },
  { latin: ['Tokyo'], zh: ['东京'], hant: ['東京'] },
  { latin: ['Kyoto'], zh: ['京都'], hant: ['京都'] },
  { latin: ['Osaka'], zh: ['大阪'], hant: ['大阪'] },
  { latin: ['Nagoya'], zh: ['名古屋'], hant: ['名古屋'] },
  { latin: ['Hong Kong'], zh: ['香港'], hant: ['香港'] },
  { latin: ['Taipei'], zh: ['台北'], hant: ['臺北', '台北'] },
  { latin: ['Shanghai'], zh: ['上海'], hant: ['上海'] },
  { latin: ['Beijing'], zh: ['北京'], hant: ['北京'] },
  { latin: ['Macau', 'Macao'], zh: ['澳门'], hant: ['澳門'] },
  { latin: ['Singapore'], zh: ['新加坡'], hant: ['新加坡'] },
];

/** Latin letters beyond ASCII: Vietnamese, and the rest of Latin. */
const MARKED = /[À-ɏḀ-ỿ]/u;
const WORD = /^\p{Lu}\p{L}*(?:[&'’.]\p{L}+)*$/u;

const prepare = (text: string) => text
  .replace(/['’]s(?![\p{L}])/gu, ',')
  .replace(/(\p{L}+)-\p{Ll}+/gu, '$1');

/** The names in `text`, as the blurb spells them. */
export function latinNames(text: string): string[] {
  const out: string[] = [];
  for (const sentence of prepare(text).split(/[.!?]+(?:\s|$)/u)) {
    sentence.split(/[,;:()—–"“”「」]+/u).forEach((clause, c) => {
      let run: string[] = [];
      let opens = false;
      const flush = () => {
        if (opens && (run.length === 1 || !MARKED.test(run[0]))) run.shift();
        while (run.length && (NOT_NAMES.has(run[0]) || (OPENERS.has(run[0]) && !MARKED.test(run.slice(1, 2).join(''))))) run.shift();
        while (run.length && NOT_NAMES.has(run[run.length - 1])) run.pop();
        const name = run.join(' ');
        if (name && !EXEMPT.has(name)) out.push(name);
        run = [];
      };
      clause.trim().split(/\s+/u).forEach((word, w) => {
        if (WORD.test(word)) {
          if (!run.length) opens = c === 0 && w === 0;
          run.push(word);
        } else {
          flush();
        }
      });
      flush();
    });
  }
  return [...new Set(out)];
}

/** The two scripts the rule is checked in. */
export type Chinese = 'zh' | 'zh-Hant';

/** Each name in `source`, with the forms a translation into `lang` may
 *  give it: the table's, or the blurb's own spelling.
 *
 *  `own` is the place's own name. A word of it is the place's, not a
 *  city's: "Coco Paris" is a bakery and "S'mores Saigon" a café, and both
 *  open their blurbs, so the city's name is read off the front of them.
 *  Such a word is asked for as the place spells it, and either form is
 *  taken — "Hanoi Museum" may well say 河内 of the city. */
export function chineseNames(source: string, lang: Chinese, own: string[] = []): { name: string; forms: string[] }[] {
  return latinNames(source).map((name) => {
    const known = EXONYMS.find((e) => e.latin.includes(name));
    if (!known) return { name, forms: [name] };
    const forms = known[lang === 'zh' ? 'zh' : 'hant'];
    return { name, forms: own.some((o) => o.includes(name)) ? [name, ...forms] : forms };
  });
}

/** The names `source` carries that `translation` does not write as the
 *  rule says, each as the form to ask for. */
export function namesLost(source: string, translation: string, lang: Chinese, own: string[] = []): string[] {
  const kept = translation.replace(/['’]s(?![\p{L}])/gu, '');
  return chineseNames(source, lang, own).filter((n) => !n.forms.some((f) => kept.includes(f))).map((n) => n.forms[0]);
}
