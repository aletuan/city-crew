// Whose words the blurb is. The desk's twin is
// `dashboard/tests/reviewer.test.mjs`; if the two drift, the screen credits
// somebody the editor did not.
import { describe, it, expect } from 'vitest';
import { blurbCredit, blurbIcon, blurbLink } from './blurbSource';

const POST = 'https://www.threads.com/@gowithchinne/post/DdeLnFwj10o';
const threads = (over = {}) => ({
  reviewer_source: 'threads',
  reviewer_name: 'gowithchinne',
  reviewer_url: POST,
  google_place_id: 'ChIJabc',
  ...over,
}) as never;

describe('blurbCredit', () => {
  it('names the person behind a Threads blurb', () => {
    expect(blurbCredit(threads())).toEqual({ kind: 'threads', name: 'gowithchinne' });
    // And bare, whatever the desk typed: the glyph beside it is the @.
    expect(blurbCredit({ reviewer_source: 'threads', reviewer_name: '@gowithchinne' } as never))
      .toEqual({ kind: 'threads', name: 'gowithchinne' });
  });

  it('credits Google without an author, because Google supplies none', () => {
    // `import-place.ts` copies `editorialSummary`. Its field mask does not
    // ask for `reviews`, so a name here could only have been invented.
    expect(blurbCredit({ reviewer_source: 'google', reviewer_name: null } as never))
      .toEqual({ kind: 'google' });
    expect(blurbCredit({ reviewer_source: 'google', reviewer_name: 'Someone' } as never))
      .toEqual({ kind: 'google' });
  });

  it('says nothing when no source was recorded', () => {
    // The common case by a wide margin: the desk wrote its own copy, or
    // there is no blurb at all.
    expect(blurbCredit({} as never)).toBeNull();
    expect(blurbCredit({ reviewer_source: null, reviewer_name: 'stray' } as never)).toBeNull();
    expect(blurbCredit({ reviewer_source: '   ' } as never)).toBeNull();
  });

  it("draws nothing for the desk's own copy, the same as for no source", () => {
    // 'editorial' is recorded so the desk can tell "we wrote this" from
    // "nobody has looked". The reader gains nothing from being told that
    // City Crew wrote the paragraph inside City Crew.
    expect(blurbCredit({ reviewer_source: 'editorial' } as never)).toBeNull();
  });

  it('carries a source it has never heard of rather than dropping it', () => {
    // The column has no check constraint on purpose; a screen that rendered
    // nothing for a new source would hide the credit instead of showing it.
    expect(blurbCredit({ reviewer_source: 'instagram', reviewer_name: 'x' } as never))
      .toEqual({ kind: 'other', source: 'instagram', name: 'x' });
  });

  it('treats a blank name as no name', () => {
    expect(blurbCredit({ reviewer_source: 'threads', reviewer_name: '  ' } as never))
      .toEqual({ kind: 'threads', name: null });
  });
});

describe('blurbLink', () => {
  it('opens the post the words were taken from', () => {
    expect(blurbLink(threads())).toBe(POST);
  });

  it('falls back to the profile when the post was not recorded', () => {
    expect(blurbLink(threads({ reviewer_url: null })))
      .toBe('https://www.threads.com/@gowithchinne');
  });

  // `maps/place/?q=place_id:<id>` was the old spelling and it does not
  // resolve — Maps searches for the literal string and offers the web
  // instead. The documented pair is what the address row already sends.
  it('sends Google the documented name-and-id pair, not a place_id string', () => {
    expect(blurbLink({
      reviewer_source: 'google', google_place_id: 'ChIJabc',
      name_en: 'Carlton Gardens', lat: -37.8, lng: 144.97,
    } as never)).toBe(
      'https://www.google.com/maps/search/?api=1&query=Carlton%20Gardens&query_place_id=ChIJabc',
    );
  });

  // No id, but a point: the coordinate is still the right place.
  it('falls back to the coordinate when the place has no Google id', () => {
    expect(blurbLink({ reviewer_source: 'google', lat: -37.8, lng: 144.97 } as never))
      .toBe('https://www.google.com/maps/search/?api=1&query=-37.8%2C144.97');
  });

  // A handle pasted with its @ would otherwise reach the URL as `@@name`.
  it('strips an @ the desk left on the handle', () => {
    expect(blurbLink(threads({ reviewer_url: null, reviewer_name: '@gowithchinne' })))
      .toBe('https://www.threads.com/@gowithchinne');
  });

  it('is null when there is nowhere to go, so the line stays plain text', () => {
    // Google with neither an id nor a point: nowhere to send anybody.
    expect(blurbLink({ reviewer_source: 'google' } as never)).toBeNull();
    expect(blurbLink({ reviewer_source: 'threads' } as never)).toBeNull();
    expect(blurbLink({ reviewer_source: 'instagram', reviewer_name: 'x' } as never)).toBeNull();
    // Even with a place id to hand: the desk's copy is not Google's.
    expect(blurbLink({
      reviewer_source: 'editorial', google_place_id: 'ChIJabc', lat: 1, lng: 1,
    } as never)).toBeNull();
    expect(blurbLink({} as never)).toBeNull();
  });
});

describe('blurbIcon', () => {
  // The two the app can draw. The glyph is what lets the line stop
  // spelling out the platform beside the handle.
  it('gives each known source its own mark', () => {
    expect(blurbIcon({ kind: 'threads', name: 'gowithchinne' })).toBe('logo-threads');
    expect(blurbIcon({ kind: 'threads', name: null })).toBe('logo-threads');
    expect(blurbIcon({ kind: 'google' })).toBe('logo-google');
  });

  // A source recorded before the app knew about it. A wrong mark would be
  // worse than none, and the line still names it in words.
  it('has no mark for a source it does not know', () => {
    expect(blurbIcon({ kind: 'other', source: 'tiktok', name: 'chinne' })).toBeNull();
    expect(blurbIcon({ kind: 'other', source: 'lonelyplanet', name: null })).toBeNull();
  });
});
