import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DOCS } from '../src/lib/legal';
import { esc, inlineHtml, renderDoc } from './legalhtml';

const published = join(dirname(fileURLToPath(import.meta.url)), '../../dashboard/public');

// The whole point of the arrangement, and the only test here that has to
// exist. `legal.ts` is the one copy of two legal documents; these two
// files are what the App Store listing points at and what anyone with the
// URL reads. If they are not what the data produces, one of them is
// lying, and until now nothing in this repository could tell which.
describe('the published pages', () => {
  for (const doc of DOCS) {
    it(`${doc.file} is what the data renders`, () => {
      const onDisk = readFileSync(join(published, doc.file), 'utf8');
      // Compared whole rather than by section: a diff of the two is
      // exactly the report a reader of this failure wants.
      expect(renderDoc(doc)).toBe(onDisk);
    });
  }
});

describe('escaping', () => {
  // Nothing in either document contains these today. They are held
  // because the day a clause needs "<13" or "R&D", the page must show it
  // rather than open a tag nobody closes.
  it('closes no tag the words did not open', () => {
    expect(esc('under <13 & over')).toBe('under &lt;13 &amp; over');
  });

  it('escapes inside a link and inside bold, href included', () => {
    expect(inlineHtml('[a & b](x.html?q=1&r=2)')).toBe('<a href="x.html?q=1&amp;r=2">a &amp; b</a>');
    expect(inlineHtml('**a < b**')).toBe('<strong>a &lt; b</strong>');
  });
});

describe('the page around the words', () => {
  it('gives each document the title its tab shows', () => {
    const html = renderDoc(DOCS[0]);
    expect(html).toContain('<title>City Crew · Terms of Service</title>');
    expect(html).toContain('<h1>City Crew — Terms of Service</h1>');
  });

  // The one affordance that exists on the page and not in the app: the
  // English half points down, the Vietnamese half carries the anchor. It
  // lives in the renderer for that reason, so a test on the data would
  // never see it go missing.
  it('keeps the two halves pointing at each other', () => {
    const html = renderDoc(DOCS[1]);
    expect(html).toContain('<a href="#vi">Tiếng Việt bên dưới</a>');
    expect(html).toContain('<h1 id="vi">');
    expect(html.indexOf('<hr />')).toBeGreaterThan(html.indexOf('#vi'));
  });

  it('ends with a newline, as a file should', () => {
    expect(renderDoc(DOCS[0]).endsWith('</html>\n')).toBe(true);
  });
});
