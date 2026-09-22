// Whose words the blurb is. The desk's twin is
// `dashboard/tests/reviewer.test.mjs`; if the two drift, the screen credits
// somebody the editor did not.
import { describe, it, expect } from 'vitest';
import { blurbCredit, blurbLink } from './blurbSource';

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

  it('builds the Maps link for Google rather than reading a stored one', () => {
    expect(blurbLink({ reviewer_source: 'google', google_place_id: 'ChIJabc' } as never))
      .toBe('https://www.google.com/maps/place/?q=place_id:ChIJabc');
  });

  it('is null when there is nowhere to go, so the line stays plain text', () => {
    expect(blurbLink({ reviewer_source: 'google' } as never)).toBeNull();
    expect(blurbLink({ reviewer_source: 'threads' } as never)).toBeNull();
    expect(blurbLink({ reviewer_source: 'instagram', reviewer_name: 'x' } as never)).toBeNull();
    // Even with a place id to hand: the desk's copy is not Google's.
    expect(blurbLink({ reviewer_source: 'editorial', google_place_id: 'ChIJabc' } as never)).toBeNull();
    expect(blurbLink({} as never)).toBeNull();
  });
});
