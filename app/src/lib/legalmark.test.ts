import { describe, expect, it } from 'vitest';
import { isDocLink, parseInline } from './legalmark';
import { DOCS } from './legal';

describe('parseInline', () => {
  it('leaves prose alone', () => {
    expect(parseInline('One account per person.')).toEqual([{ text: 'One account per person.' }]);
  });

  it('lifts a bold run out of the sentence around it', () => {
    expect(parseInline('It does **not** hide their lists.')).toEqual([
      { text: 'It does ' },
      { text: 'not', bold: true },
      { text: ' hide their lists.' },
    ]);
  });

  it('reads a link as its words and its destination', () => {
    expect(parseInline('See our [Privacy Policy](privacy.html) for more.')).toEqual([
      { text: 'See our ' },
      { text: 'Privacy Policy', href: 'privacy.html' },
      { text: ' for more.' },
    ]);
  });

  it('handles both marks in one line, in order', () => {
    expect(parseInline('**A** then [b](c) then d')).toEqual([
      { text: 'A', bold: true },
      { text: ' then ' },
      { text: 'b', href: 'c' },
      { text: ' then d' },
    ]);
  });

  it('takes the shorter of two possible bold runs', () => {
    expect(parseInline('**a** and **b**')).toEqual([
      { text: 'a', bold: true },
      { text: ' and ' },
      { text: 'b', bold: true },
    ]);
  });

  // A typo in a legal document should render as a typo. Swallowing the
  // rest of the paragraph — or throwing — is the one outcome worse than
  // showing a stray asterisk to a reader.
  it('treats an unclosed mark as the text it is', () => {
    expect(parseInline('**never closed')).toEqual([{ text: '**never closed' }]);
    expect(parseInline('a [b without a target')).toEqual([{ text: 'a [b without a target' }]);
  });

  it('has nothing to say about an empty line', () => {
    expect(parseInline('')).toEqual([]);
  });
});

describe('isDocLink', () => {
  it('knows our own pages from everywhere else', () => {
    expect(isDocLink('privacy.html')).toBe(true);
    expect(isDocLink('terms.html')).toBe(true);
    expect(isDocLink('https://supabase.com')).toBe(false);
    expect(isDocLink('mailto:anhlt1983@gmail.com')).toBe(false);
    // The page's own "Tiếng Việt bên dưới" anchor. The sheet shows one
    // language at a time, so there is nothing below to jump to.
    expect(isDocLink('#vi')).toBe(false);
  });
});

// The parser is only worth anything if it survives the documents it was
// written for. This walks every line of both, in both languages, and
// insists nothing came out mangled — no span with an empty text, and
// every link pointing somewhere.
describe('against the real documents', () => {
  it('parses every line of both, in both languages', () => {
    let links = 0;
    let bolds = 0;
    for (const doc of DOCS) {
      for (const b of doc.blocks) {
        const lines = b.k === 'ul' ? [...b.en, ...b.vi] : [b.en, b.vi];
        for (const line of lines) {
          const spans = parseInline(line);
          expect(spans.map((s) => s.text).join('')).not.toBe('');
          for (const s of spans) {
            expect(s.text.length).toBeGreaterThan(0);
            if (s.href) { links += 1; expect(s.href.length).toBeGreaterThan(0); }
            if (s.bold) bolds += 1;
          }
        }
      }
    }
    // Not round numbers for their own sake: they are the count the pages
    // carry, so losing a link to a bad edit of the data shows up here
    // rather than as a dead phrase in the sheet. They move when the
    // documents do, and the move is the thing to read — 42 became 44 when
    // the activity-history clause was rewritten for the on-by-default
    // change, which turned one emphasis per language into two: the default
    // itself, and the delete button that answers it.
    expect(links).toBe(12);
    expect(bolds).toBe(44);
  });
});
