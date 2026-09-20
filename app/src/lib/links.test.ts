// The label a link wears, against the values the catalog actually holds.
//
// Every string below except the invented ones is a real `website` out of
// production, kept verbatim — tracking query, fbclid, share-sheet junk and
// all. That is the point: the fault this module fixes was not visible in a
// tidy fixture, because a tidy URL was never the problem.

import { describe, expect, it } from 'vitest';
import {
  atHandle, hostOf, instagramUrl, threadsUrl, websiteRepeatsHandle,
} from './links';

describe('hostOf', () => {
  it('keeps a plain domain', () => {
    expect(hostOf('https://anticofornaio.com')).toBe('anticofornaio.com');
  });

  it('drops the scheme and the www', () => {
    expect(hostOf('https://www.guwinebistro.com/')).toBe('guwinebistro.com');
    expect(hostOf('http://www.radissonhotels.com/en-us/hotels')).toBe('radissonhotels.com');
  });

  // The 56 rows carrying a query nobody typed. Shown whole, these ran to 245
  // characters; the row is one line.
  it('drops the tracking a share sheet attached', () => {
    expect(hostOf('https://anticofornaio.com/?utm_source=google&utm_medium=organic&utm_campaign=mapera_google_profile&utm_content=website_button'))
      .toBe('anticofornaio.com');
    expect(hostOf('https://www.instagram.com/pizzabella.hanoi?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=='))
      .toBe('instagram.com');
    expect(hostOf('https://www.facebook.com/people/magichastand/61567169829674/?mibextid=wwXIfr&rdid=goPONKMbZMaMpYi4'))
      .toBe('facebook.com');
  });

  // No scheme at all is common enough that `new URL()` was never an option:
  // it throws on every one of these.
  it('reads a URL that never had a scheme', () => {
    expect(hostOf('tinycafe.vn/cau-chuyen/?fbclid=IwVERDUAUQnQRwZG9mBWZkaWQ')).toBe('tinycafe.vn');
    expect(hostOf('booking.ipos.vn/public/booking/3343741d?source=IFRAME')).toBe('booking.ipos.vn');
  });

  it('drops a port and a fragment', () => {
    expect(hostOf('http://example.com:8080/menu#drinks')).toBe('example.com');
  });

  // An `@` before the host is credentials; an `@` after it is somebody's
  // handle inside a query, and cutting there would have eaten the host.
  it('drops credentials without being fooled by an @ in the query', () => {
    expect(hostOf('https://user:pw@example.com/a')).toBe('example.com');
    expect(hostOf('https://example.com/a?to=me@example.org')).toBe('example.com');
  });

  it('lowercases, and loses the root dot of a fully qualified name', () => {
    expect(hostOf('HTTPS://WWW.Example.COM./')).toBe('example.com');
  });

  // `website` is free text an editor fills, so this has to answer something
  // for input that is not a URL. Empty is the honest answer, and the screen
  // draws no row for it.
  it('is empty for nothing, whitespace, and a null', () => {
    expect(hostOf('')).toBe('');
    expect(hostOf('   ')).toBe('');
    expect(hostOf(null)).toBe('');
    expect(hostOf(undefined)).toBe('');
  });

  it('gives back whatever it was handed when that is not a URL', () => {
    expect(hostOf('ask at the door')).toBe('ask at the door');
  });
});

describe('the handle links', () => {
  it('puts the @ back for a reader and leaves it off for Instagram', () => {
    expect(atHandle('cab.cafesg')).toBe('@cab.cafesg');
    expect(instagramUrl('cab.cafesg')).toBe('https://www.instagram.com/cab.cafesg');
  });

  // Threads wants the @ in the path; Instagram refuses it. The two hosts
  // differ too, which is the whole reason they are constants in one file.
  it('puts the @ in the path for Threads', () => {
    expect(threadsUrl('sweet.as.hanoi')).toBe('https://www.threads.com/@sweet.as.hanoi');
  });
});

describe('websiteRepeatsHandle', () => {
  it('is true when the website is the Instagram account already shown', () => {
    expect(websiteRepeatsHandle(
      'https://www.instagram.com/cab.cafesg?igsh=MXJod3k3',
      { instagram: 'cab.cafesg' },
    )).toBe(true);
  });

  it('is true for either Threads host', () => {
    expect(websiteRepeatsHandle('https://threads.net/@x', { threads: 'x' })).toBe(true);
    expect(websiteRepeatsHandle('https://www.threads.com/@x', { threads: 'x' })).toBe(true);
  });

  // The case that keeps the link: a profile URL on a place nobody has looked
  // up yet is the one way to reach the venue.
  it('is false when there is no handle to repeat', () => {
    expect(websiteRepeatsHandle('https://www.instagram.com/someone', {})).toBe(false);
    expect(websiteRepeatsHandle('https://www.instagram.com/someone', { instagram: null })).toBe(false);
    expect(websiteRepeatsHandle('https://threads.net/@x', { threads: null })).toBe(false);
  });

  // A Facebook page is not a handle row — there is no column for it — so the
  // website row stays and carries it.
  it('is false for a website that is not one of the two', () => {
    expect(websiteRepeatsHandle(
      'https://www.facebook.com/people/magichastand/61567169829674/',
      { instagram: 'magicha.zenbar', threads: 'magicha.zenbar' },
    )).toBe(false);
    expect(websiteRepeatsHandle('https://anticofornaio.com', { instagram: 'x' })).toBe(false);
  });

  it('is false for no website at all', () => {
    expect(websiteRepeatsHandle(null, { instagram: 'x' })).toBe(false);
    expect(websiteRepeatsHandle('', { instagram: 'x' })).toBe(false);
  });
});
