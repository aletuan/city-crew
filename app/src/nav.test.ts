// Every screen a screen navigates to has to be in its own stack.
//
// This is the one navigation rule the type system cannot hold.
// `RootStackParamList` is a single flat list covering all five stacks, so
// `Nav` believes every screen can reach every route — which is convenient
// everywhere and wrong in exactly one way: a screen whose *own* stack does
// not register the target still typechecks, and at runtime the action
// bubbles up to the tab navigator and lands in whichever other stack does
// have it.
//
// That is not a crash, which is what makes it worth a test. It looks like
// the app working: the detail screen opens, and the reader is silently in
// a different tab with a Back button that no longer goes back to what they
// were doing. It shipped once — tapping a stop in the plan editor jumped
// to the Explore tab and stranded a half-edited plan behind it — and
// nothing failed to notice.
//
// ── what this can and cannot see ──
//
// It reads the source with regular expressions. It therefore catches the
// literal `navigation.navigate('Foo')` that every call site in this app is
// written as, and would miss a route name held in a variable. That is a
// real limit rather than a hedge: if one is ever written that way, this
// test goes quietly blind to it, and the comment is here so the next
// person knows to look.
//
// `goTo()` is deliberately not checked. It crosses tabs on purpose, via
// the container ref rather than a stack's navigator — see `nav.ts`.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');

/** Stack name → the routes it registers, and the screen components in it. */
function stacksOf(source: string) {
  const stacks = new Map<string, { routes: Set<string>; components: string[] }>();
  for (const m of source.matchAll(/function (\w+Stack)\(\)\s*\{([\s\S]*?)\n\}/g)) {
    const [, name, body] = m;
    stacks.set(name, {
      routes: new Set([...body.matchAll(/<Stack\.Screen name="(\w+)"/g)].map((r) => r[1])),
      components: [...body.matchAll(/component=\{(\w+)\}/g)].map((r) => r[1]),
    });
  }
  return stacks;
}

describe('every stack registers what its screens navigate to', () => {
  const app = readFileSync(join(ROOT, 'App.tsx'), 'utf8');
  const stacks = stacksOf(app);

  // A guard on the guard. If the stacks are ever written a different way —
  // a helper, a config array — the regexes above quietly match nothing and
  // this file passes by finding no work to do.
  it('found the stacks to check', () => {
    expect(stacks.size).toBeGreaterThanOrEqual(5);
    for (const [name, { routes, components }] of stacks) {
      expect(routes.size, `${name} registers no routes`).toBeGreaterThan(0);
      expect(components.length, `${name} has no components`).toBeGreaterThan(0);
    }
  });

  /** Screen component name → the stacks it is registered in. */
  const homes = new Map<string, string[]>();
  for (const [stack, { components }] of stacks) {
    for (const c of components) homes.set(c, [...(homes.get(c) ?? []), stack]);
  }

  const screens = readdirSync(join(ROOT, 'src/screens')).filter((f) => f.endsWith('.tsx'));

  it('found the screens to check', () => {
    expect(screens.length).toBeGreaterThan(10);
  });

  for (const file of screens) {
    const component = file.replace(/\.tsx$/, '');
    const inStacks = homes.get(component);
    // Not every file under `screens/` is a registered screen — some are
    // presentational pieces another screen renders. Nothing to check.
    if (!inStacks) continue;

    const body = readFileSync(join(ROOT, 'src/screens', file), 'utf8');
    const targets = [...body.matchAll(/navigation\.(?:navigate|replace|push)\(\s*'(\w+)'/g)]
      .map((m) => m[1]);
    if (!targets.length) continue;

    for (const stack of inStacks) {
      it(`${component} in ${stack}`, () => {
        const routes = stacks.get(stack)!.routes;
        const missing = [...new Set(targets)].filter((t) => !routes.has(t));
        expect(
          missing,
          `${component} navigates to ${missing.join(', ')}, which ${stack} does not register — `
          + 'the action will bubble to the tabs and open in another one',
        ).toEqual([]);
      });
    }
  }
});
