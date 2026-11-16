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
import { RefreshControl } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';
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

import { AuthScreen, FieldRow, FormError, useFailSentences, useFailText } from './authUi';

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

// UX-07: the eye beside a password was "Toggle password visibility", in
// English on every build, naming both directions and so neither.
describe('the password eye', () => {
  it('says which way a press goes, in the reader\'s language', () => {
    lang = 'vi';
    render(<FieldRow icon="lock-closed-outline" label="Mật khẩu" secure value="" onChangeText={() => {}} />);
    const eye = screen.getByRole('button', { name: 'Hiện mật khẩu' });
    fireEvent.click(eye);
    expect(screen.getByRole('button', { name: 'Ẩn mật khẩu' })).toBe(eye);
    fireEvent.click(eye);
    expect(screen.getByRole('button', { name: 'Hiện mật khẩu' })).toBe(eye);
  });
});

// A caller's props go under the row's own two, not over them (SOLID
// review, L). Spread last, `style` replaced the field's type rather than
// adding to it, and `secureTextEntry` overrode the eye.
describe('a caller\'s TextInput props', () => {
  it('adds a style to the field\'s own rather than replacing it', () => {
    lang = 'en';
    render(
      <FieldRow icon="mail-outline" label="Email" value="a@b.co" testID="f"
        style={{ letterSpacing: 3 }} onChangeText={() => {}} />,
    );
    // react-native-web writes a sheet's rules as atomic classes, which
    // jsdom does not compute, and an inline style as an inline style. So
    // the field's own type is read off its class, the caller's off the
    // element — both have to be there.
    const field = screen.getByTestId('f');
    expect(field.style.letterSpacing).toBe('3px');
    expect(field.className).toMatch(/\br-fontSize-/);
  });

  it('cannot keep a password hidden that the eye has shown', () => {
    lang = 'en';
    render(
      <FieldRow icon="lock-closed-outline" label="Password" secure secureTextEntry value="pw"
        testID="p" onChangeText={() => {}} />,
    );
    const field = screen.getByTestId('p') as HTMLInputElement;
    expect(field.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(field.type).toBe('text');
  });
});

// A pull to reload, offered by Activity alone (13 Nov 2026). The forms
// pass nothing, and a form that could be pulled into a spinner that
// reloads nothing would be a gesture lying about what it does.
// The grouped row with no card round it (the collection form, 16 Nov
// 2026): the small label over the value, and no padding of its own — the
// page's margin and the screen's gap are its distances.
describe('a grouped row laid on the page', () => {
  const rowOf = (id: string) => screen.getByTestId(id).parentElement!.parentElement as HTMLElement;
  const pad = (el: HTMLElement) => { const c = getComputedStyle(el); return [c.paddingLeft, c.paddingRight, c.paddingTop, c.paddingBottom]; };

  it('has no glyph and no padding, where a card\'s row keeps the card\'s', () => {
    lang = 'en';
    render(<FieldRow grouped flush icon="bookmark-outline" label="Collection name" value="x" testID="flush" onChangeText={() => {}} />);
    expect(document.querySelector('[data-icon="bookmark-outline"]')).toBeNull();
    expect(pad(rowOf('flush'))).toEqual(['0px', '0px', '0px', '0px']);
    expect(screen.getByText('Collection name')).toBeTruthy();

    render(<FieldRow grouped icon="bookmark-outline" label="In a card" value="x" testID="carded" onChangeText={() => {}} />);
    expect(pad(rowOf('carded'))).toEqual(['16px', '16px', '11px', '11px']);
  });

  it('starts its error on the same margin', () => {
    lang = 'en';
    render(<FieldRow grouped flush icon="at-outline" label="Name" value="x" error="Taken" onChangeText={() => {}} />);
    expect(getComputedStyle(screen.getByText('Taken')).paddingLeft).toBe('0px');
    render(<FieldRow grouped icon="at-outline" label="Name" value="x" error="Taken too" onChangeText={() => {}} />);
    expect(getComputedStyle(screen.getByText('Taken too')).paddingLeft).toBe('16px');
  });

  // The label 6 over its value in a grouped row, in a card or on the
  // page, one line or many (owner, 16 Nov 2026): at the box's 2 a label
  // with marks under it all but met a value with marks over it. A boxed
  // field keeps its 2.
  it('stands the label 6 over the value, where a boxed field keeps 2', () => {
    lang = 'en';
    const gapOver = (id: string) => {
      const c = getComputedStyle(screen.getByTestId(id).parentElement as HTMLElement);
      return c.rowGap || c.gap;
    };
    render(<FieldRow grouped flush icon="bookmark-outline" label="Name" value="x" testID="on-page" onChangeText={() => {}} />);
    render(<FieldRow grouped icon="bookmark-outline" label="Name" value="x" testID="in-card" onChangeText={() => {}} />);
    render(<FieldRow grouped flush multiline icon="text-outline" label="Words" value="x" testID="many-lines" onChangeText={() => {}} />);
    render(<FieldRow icon="mail-outline" label="Email" value="x" testID="in-box" onChangeText={() => {}} />);
    expect(['on-page', 'in-card', 'many-lines', 'in-box'].map(gapOver)).toEqual(['6px', '6px', '6px', '2px']);
  });

  // A boxed field has a border to pad away from: `flush` is the grouped
  // row's, and means nothing without it.
  it('leaves a boxed field its box', () => {
    lang = 'en';
    render(<FieldRow flush icon="mail-outline" label="Email" value="x" testID="boxed" error="Bad" onChangeText={() => {}} />);
    expect(pad(rowOf('boxed')).slice(0, 2)).toEqual(['16px', '16px']);
    expect(document.querySelector('[data-icon="mail-outline"]')).toBeTruthy();
    expect(getComputedStyle(screen.getByText('Bad')).paddingLeft).toBe('16px');
  });
});

describe('the frame\'s pull to reload', () => {
  /** Every committed RefreshControl's props — by its type, so the
   *  frame's own props, which carry the same two names, are not taken for
   *  the control they ask for. */
  const pulls = (): Record<string, unknown>[] => {
    type Fiber = { child: Fiber | null; sibling: Fiber | null; type: unknown; memoizedProps: Record<string, unknown> | null };
    const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
    const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
    const stack: Fiber[] = [host[key].stateNode.current];
    const out: Record<string, unknown>[] = [];
    while (stack.length) {
      const fb = stack.pop()!;
      const p = fb.memoizedProps;
      if (fb.type === RefreshControl && p) out.push(p);
      if (fb.sibling) stack.push(fb.sibling);
      if (fb.child) stack.push(fb.child);
    }
    return out;
  };

  it('is not there unless the screen offers one', () => {
    render(<AuthScreen><FormError>x</FormError></AuthScreen>);
    expect(pulls()).toEqual([]);
  });

  it('hangs the screen\'s own reload and spinner on the scroll when it does', () => {
    const reload = vi.fn();
    render(<AuthScreen onRefresh={reload} refreshing><FormError>x</FormError></AuthScreen>);
    const [p] = pulls();
    expect(p.refreshing).toBe(true);
    (p.onRefresh as () => void)();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('is at rest until told otherwise', () => {
    render(<AuthScreen onRefresh={() => {}}><FormError>x</FormError></AuthScreen>);
    expect(pulls()[0].refreshing).toBe(false);
  });
});
