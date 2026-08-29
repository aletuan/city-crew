// @vitest-environment jsdom
//
// Every failure this app can name, in every language it claims to speak.
//
// The thing this catches is silent: `t(en, vi, ja)` falls back to English
// whenever a translation is missing, so a name added with only its English
// sentence renders perfectly and is wrong for two thirds of the readers.
// Nothing else in the suite would notice — the screen tests all mock `t`
// down to its English arm, which is exactly the arm that cannot fail.
//
// The names are read off the table rather than listed here. A list kept by
// hand could only cover the entries somebody remembered to copy across,
// and an entry nobody has copied yet is precisely the shape of the bug.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '../uitest/render';
import type { Lang } from '../lib/i18n';

// Read at call time, not at mock time, so one file can render all three.
let lang: Lang = 'en';

// The real implementation of `t`, fallbacks included — a mock that always
// returned the right variant would be testing itself.
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang,
    setLang: () => {},
    t: (en?: string | null, vi_?: string | null, ja?: string | null) => {
      if (lang === 'vi') return vi_ ?? en ?? '';
      if (lang === 'ja') return ja ?? en ?? vi_ ?? '';
      return en ?? vi_ ?? '';
    },
  }),
}));

import { FormError, useFailSentences, useFailText } from './authUi';

/** Every sentence in the table, as a phone set to `at` would read them. */
function sentences(at: Lang): Record<string, string> {
  lang = at;
  let read: Record<string, string> = {};
  function Probe() {
    read = useFailSentences();
    return null;
  }
  const { unmount } = render(<Probe />);
  unmount();
  return read;
}

/** What one name reads as, through the lookup a screen actually calls. */
function say(name: string, at: Lang): string {
  lang = at;
  function Probe() {
    return <FormError>{useFailText()(name)}</FormError>;
  }
  const { unmount, container } = render(<Probe />);
  const said = container.textContent ?? '';
  unmount();
  return said;
}

describe('every named failure', () => {
  const en = sentences('en');
  const vi = sentences('vi');
  const ja = sentences('ja');
  const names = Object.keys(en);

  // Proof the table was really read. Without this the checks below pass
  // vacuously on an empty object, which is the one way this file could
  // look green while testing nothing.
  it('reads the table the screens use', () => {
    expect(names).toContain('offline');
    expect(names).toContain('need_email');
    expect(names.length).toBeGreaterThan(15);
  });

  // One assertion over every name, rather than one test each: the point is
  // the list of what is missing, and a failure that names all of them at
  // once is more useful than the first one alphabetically.
  it('is written in all three languages', () => {
    const missing = names.filter((n) => vi[n] === en[n] || ja[n] === en[n] || ja[n] === vi[n]);
    expect(missing).toEqual([]);
  });

  it('says something, and never just its own name', () => {
    for (const n of names) {
      for (const said of [en[n], vi[n], ja[n]]) {
        expect(said.length).toBeGreaterThan(0);
        expect(said).not.toBe(n);
      }
    }
  });
});

describe('a failure with no name', () => {
  // The server's own words, untranslated by definition — the same English
  // in all three, because there is nothing to translate it with. Kept
  // rather than flattened: the server's specific line says more than a
  // sentence that covered every failure could.
  it('reaches the reader as it came, in every language', () => {
    const raw = 'Signups not allowed for this instance';
    for (const at of ['en', 'vi', 'ja'] as Lang[]) expect(say(raw, at)).toBe(raw);
  });

  // The polish that prompted this pass: GoTrue answers an empty sign-in
  // form in lower case, and a lower-case line in a banner reads as leaked.
  it('is started like a sentence even so', () => {
    expect(say('missing email or phone', 'vi')).toBe('Missing email or phone');
  });
});

describe('the banner itself', () => {
  it('carries the sentence and a glyph, and announces itself', () => {
    lang = 'vi';
    const { container } = render(<FormError>Email hoặc mật khẩu không đúng.</FormError>);
    const banner = container.firstElementChild as HTMLElement;

    expect(banner.getAttribute('aria-live')).toBe('polite');
    expect(banner.querySelector('[data-icon="alert-circle"]')).toBeTruthy();
    expect(banner.textContent).toContain('Email hoặc mật khẩu không đúng.');
  });
});
