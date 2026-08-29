import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PRIVACY_URL, TERMS_URL } from './links';

const here = dirname(fileURLToPath(import.meta.url));
const filename = (url: string) => new URL(url).pathname.replace(/^.*\//, '');
/** Where the file behind a URL has to be sitting for that URL to exist. */
const published = (url: string) => join(here, '../../../dashboard/public', filename(url));

describe('the public documents', () => {
  // Written out in full rather than composed, so a reader of the diff
  // sees the exact string a phone will open. These two also go into the
  // App Store listing; they have to match what is filed there.
  it('are where the store listing says they are', () => {
    expect(TERMS_URL).toBe('https://aletuan.github.io/city-crew/terms.html');
    expect(PRIVACY_URL).toBe('https://aletuan.github.io/city-crew/privacy.html');
  });

  // The half a string comparison cannot check. `deploy-dashboard.yml`
  // publishes `dashboard/public/` verbatim, so each URL is live only
  // because a file of that name is sitting in that folder — rename or
  // move one and the sign-up screen goes on rendering a link that 404s.
  it('each answer to a file that is actually published', () => {
    expect(existsSync(published(TERMS_URL))).toBe(true);
    expect(existsSync(published(PRIVACY_URL))).toBe(true);
  });

  // App Store review opens these from the listing, on a device that will
  // refuse plain http. Cheap to hold, expensive to find out.
  it('are https, and on the one origin', () => {
    for (const url of [TERMS_URL, PRIVACY_URL]) {
      expect(new URL(url).protocol).toBe('https:');
      expect(new URL(url).origin).toBe('https://aletuan.github.io');
    }
  });
});
