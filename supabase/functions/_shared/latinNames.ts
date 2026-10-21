// The names a translation must keep as the blurb spells them.
//
// The owner's rule for Chinese (21 Oct 2026, restated the same day): a
// city, a place and an address stay in Latin letters — Hà Nội, not 河內;
// Nguyễn Huệ, not 阮惠街; Hoàn Kiếm Lake, not 還劍湖. They are the names
// on the signs and the map a visitor reads, and a transliteration is a
// second name that matches neither. `write-blurb` says so in its
// instructions, and the model broke it anyway: of the 257 Simplified
// blurbs written that morning, 71 had dropped at least one Latin name
// the English carried, and the first Traditional drafts turned Long Hai
// into 長海. So the rule is checked, not only asked for.
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
//   (81st → 81 層, District 1 → the number kept, the order changed).
// - A possessive, which ends a name ("LAPH's Vỹ Dạ branch" is two).
// - "-style" and the like: Hanoi-style is Hanoi.
// - People, and places whose own name is written in Chinese characters
//   (胡志明, 名古屋, 香港): Latin would be the foreign spelling there.
//
// A name is kept when it appears in the translation exactly, ignoring a
// possessive. Plain TypeScript, no Deno APIs, so the app's test runner
// can hold it to that (`app/src/lib/latinNames.test.ts`).

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
]);

/** People, and places whose own name is in Chinese characters. */
const EXEMPT = new Set([
  'Ho Chi Minh', 'Gia Long', 'Gustave Eiffel', 'Nguyen', 'Tran',
  'Hong Kong', 'Nagoya', 'Tokyo', 'Kyoto', 'Osaka', 'Taipei', 'Shanghai', 'Beijing', 'Macau', 'Singapore',
]);

/** Latin letters beyond ASCII: Vietnamese, and the rest of Latin. */
const MARKED = /[À-ɏḀ-ỿ]/u;
const WORD = /^\p{Lu}\p{L}*(?:[&'’.]\p{L}+)*$/u;

const prepare = (text: string) => text
  .replace(/['’]s(?![\p{L}])/gu, ',')
  .replace(/(\p{L}+)-\p{Ll}+/gu, '$1');

/** The Latin names in `text` that a translation of it must carry. */
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

/** The names `source` carries that `translation` lost. */
export function namesLost(source: string, translation: string): string[] {
  const kept = translation.replace(/['’]s(?![\p{L}])/gu, '');
  return latinNames(source).filter((name) => !kept.includes(name));
}
