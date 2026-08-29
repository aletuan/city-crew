// The two public documents, and the one place their addresses live.
//
// Both are plain files under `dashboard/public/`, which Vite copies
// verbatim into the build that `deploy-dashboard.yml` publishes to
// GitHub Pages — so the app and the pages ship from the same repository
// and the same merge, but over two different pipes.
//
// They are constants rather than literals in a screen because a typo
// here is the kind of mistake nothing catches: the sign-up screen still
// renders, the link still looks like a link, and the first reader to
// find out is an App Store reviewer tapping it. The test beside this
// file is the only thing standing between that typo and review.

const SITE = 'https://aletuan.github.io/city-crew';

export const TERMS_URL = `${SITE}/terms.html`;
export const PRIVACY_URL = `${SITE}/privacy.html`;
