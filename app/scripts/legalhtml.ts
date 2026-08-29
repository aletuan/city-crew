// The published pages, rendered from the same blocks the app draws.
//
// Two copies of a legal document is how privacy.html came to say "there
// is no password" while the form linking to it had a password field. So
// there is one copy — `legal.ts` — and this turns it into the files under
// `dashboard/public/` that `deploy-dashboard.yml` publishes and that the
// App Store listing points at.
//
// `npm run legal:build` writes them; `legalhtml.test.ts` fails if what is
// committed is not what these blocks produce. Neither file is edited by
// hand again.
//
// The style block below is the one those pages already wore, kept whole
// rather than rebuilt: a reader who has the URL bookmarked should not see
// the page change because its source moved.
//
// It lives in `scripts/` rather than in `src/lib` because it is not app
// code: it renders web pages, and Metro should never see it. That also
// keeps the `.ts` import extensions Node's resolver needs out of the
// app's own source, where they would have to satisfy the bundler too.

import type { Block, Doc } from '../src/lib/legal.ts';
import { parseInline } from '../src/lib/legalmark.ts';

const STYLE = `  :root { color-scheme: dark; }
  body {
    margin: 0; padding: 48px 20px 80px; background: #0B0910; color: #EDE9E3;
    font: 16px/1.65 -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  main { max-width: 680px; margin: 0 auto; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  h2 { font-size: 19px; margin: 40px 0 8px; color: #FF6F5B; }
  h3 { font-size: 16px; margin: 24px 0 6px; }
  p, li { color: #C9C3BA; }
  .muted { color: #8A847B; font-size: 14px; }
  a { color: #FF6F5B; }
  hr { border: 0; border-top: 1px solid rgba(255,255,255,0.12); margin: 48px 0; }
  strong { color: #EDE9E3; }`;

/** The three characters that would otherwise close a tag we did not open.
 *  Quotes stay as they are: nothing here renders into an attribute. */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** One line of prose, with its bold runs and links put back. */
export function inlineHtml(line: string): string {
  return parseInline(line)
    .map((s) => {
      if (s.bold) return `<strong>${esc(s.text)}</strong>`;
      if (s.href) return `<a href="${esc(s.href)}">${esc(s.text)}</a>`;
      return esc(s.text);
    })
    .join('');
}

function blockHtml(b: Block, lang: 'en' | 'vi'): string {
  if (b.k === 'ul') {
    const items = b[lang].map((li) => `    <li>${inlineHtml(li)}</li>`).join('\n');
    return `  <ul>\n${items}\n  </ul>`;
  }
  return `  <${b.k}>${inlineHtml(b[lang])}</${b.k}>`;
}

/**
 * Half a page: the heading, the effective date, and the blocks.
 *
 * The English half points down to the Vietnamese one and the Vietnamese
 * half carries the anchor it points at — a page affordance with no
 * counterpart in the app, which shows one language at a time. That is why
 * the link lives here and not in the data.
 */
function halfHtml(doc: Doc, lang: 'en' | 'vi'): string {
  const head = lang === 'en'
    ? `  <h1>City Crew — ${esc(doc.title.en)}</h1>\n`
      + `  <p class="muted">${esc(doc.effective.en)} · <a href="#vi">Tiếng Việt bên dưới</a></p>`
    : `  <h1 id="vi">City Crew — ${esc(doc.title.vi)}</h1>\n`
      + `  <p class="muted">${esc(doc.effective.vi)}</p>`;
  return [head, '', ...doc.blocks.map((b) => blockHtml(b, lang))].join('\n');
}

/** A whole page, ready to write. Ends with a newline, as a file should. */
export function renderDoc(doc: Doc): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#0B0910" />
<title>City Crew · ${esc(doc.title.en)}</title>
<style>
${STYLE}
</style>
</head>
<body>
<main>
${halfHtml(doc, 'en')}

  <hr />

${halfHtml(doc, 'vi')}
</main>
</body>
</html>
`;
}
