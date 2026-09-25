// The desk's actions, in both of the seats CSS shows them from.
//
// Above 960px the actions sit in the page head; below it the page head's
// actions are hidden (`.pagehead-actions { display: none }`) and the
// phone's sticky top bar carries its own copy. The copy is the risk: the
// day Publish moved into the page head (#634) it was not copied, and for
// three days a phone could not publish anything — the desktop showed
// "Publish 24" and the phone showed nothing where it had been.
//
// No renderer here (the desk's tests are plain node), so this reads the
// source the way `theme.test.mjs` reads the stylesheet: the two blocks
// are cut out by their class names and asked whether each carries every
// action. It is a text test, and it would catch the exact regression.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/theme.css', import.meta.url), 'utf8');

/** The JSX between the opening tag carrying `className` and the matching
 *  closing tag named `tag` — the first one after it, which is enough for
 *  blocks that nest no element of their own kind. */
function block(className, tag) {
  const start = app.indexOf(`className="${className}"`);
  assert.ok(start >= 0, `no element with className="${className}" in App.jsx`);
  const end = app.indexOf(`</${tag}>`, start);
  assert.ok(end > start, `no closing </${tag}> after className="${className}"`);
  return app.slice(start, end);
}

const ACTIONS = ['{publishButton}', 'className="syncbtn addbtn primary"', '<UnfiledBell'];

test('the phone top bar and the page head carry the same actions', () => {
  const topbar = block('topbar', 'header');
  const pagehead = block('pagehead-actions', 'div');
  for (const action of ACTIONS) {
    assert.ok(topbar.includes(action), `top bar is missing ${action}`);
    assert.ok(pagehead.includes(action), `page head is missing ${action}`);
  }
});

test('the publish button is one element, not two copies', () => {
  // Two literal <button className="publishbtn"> would be two places to
  // change the label, the handler and the disabled state — which is how
  // the two seats came to differ in the first place.
  assert.equal(app.split('className="publishbtn"').length - 1, 1);
});

test('one of the two seats is hidden at every width', () => {
  // The seats are duplicates by design; both showing at once would be
  // two Publish buttons on one screen.
  assert.match(css, /@media \(min-width: 961px\) \{ \.topbar \{ display: none; \} \}/);
  assert.match(css, /@media \(max-width: 960px\) \{ \.pagehead-actions \{ display: none; \} \}/);
});
