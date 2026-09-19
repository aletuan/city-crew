# What the desk's gate holds, and what it does not

```
node --test-coverage-lines=46 --test-coverage-branches=69 --test-coverage-functions=11
```

Three floors, not three targets — the figures the suite stood at when it
last grew, rounded down. They exist to catch a change that deletes tests,
not to describe an ambition.

## Why they are so much lower than the app's

`app/` holds its pure half at 100% and its screens at 95, because a React
Native tree can be rendered into jsdom and driven. Nothing here can be.
The desk's tests are `node:test` over plain modules: `api.js` with a fake
Supabase client, and the arithmetic modules — `contributors.js`,
`coverage.js`, `reports.js`, `storage.js` — which are folds over plain
rows and sit at or near 100%.

Everything in `src/components/` is untested. There is no renderer in this
suite, no DOM, and no harness to add one to.

## The consequence, which is worth stating plainly

**Every component this dashboard grows lowers the function percentage**,
whatever its quality, because each handler and each effect callback is a
function the denominator counts and the numerator cannot. The number is
therefore a ratchet running the wrong way: it falls when the desk gains a
feature and rises only when somebody moves logic out of a component into
a module that can be tested.

That is what happened when the local-guide checkbox joined the
contributors leaderboard: 12.52% → 11.02%, and the floor moved from 12 to
11 to match. The optimistic-update fold went into `contributors.js` as
`withGuide` and is tested there — which is the right instinct and was
worth about half a point.

**The fix is a component harness**, not a lower floor. Until there is one,
each UI change here will meet this file, and each should do what that
change did: take everything decidable out of the component first, test it
in a module, and move the floor only for what is genuinely left.
