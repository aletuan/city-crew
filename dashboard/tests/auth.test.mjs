// dashboard/src/auth.jsx is the gate in front of the whole desk, and had no
// test at all — auth.jsx itself is untestable under plain `node --test`
// (it's JSX; there is no loader in this project that can parse it outside
// a Vite build). Its two most important pieces of logic — where a magic
// link redirects, and which of the two gates (session, then is_editor) is
// currently blocking someone — live in `src/lib/authGate.js`, a plain
// module with no JSX, for exactly this reason.
//
// The rest of the file (the actual <Login>/<SetPassword> forms, and
// AuthGate's effects) still needs a DOM and a component-testing library to
// exercise directly — see the note left in the test-coverage backlog.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRedirectTo, resolveAuthView } from '../src/lib/authGate.js';

test('buildRedirectTo keeps the Pages subpath, not just the origin', () => {
  assert.equal(
    buildRedirectTo('https://aletuan.github.io', '/city-crew/'),
    'https://aletuan.github.io/city-crew/',
  );
});

test('buildRedirectTo works the same on localhost, with no subpath to lose', () => {
  assert.equal(buildRedirectTo('http://localhost:5173', '/'), 'http://localhost:5173/');
});

test('resolveAuthView: no session read yet is loading, not signed-out', () => {
  assert.equal(resolveAuthView({ session: undefined, editor: undefined, recovering: false }), 'loading');
});

test('resolveAuthView: a null session is signed-out', () => {
  assert.equal(resolveAuthView({ session: null, editor: undefined, recovering: false }), 'signed-out');
});

test('resolveAuthView: recovering wins over an unknown or negative editor check', () => {
  assert.equal(
    resolveAuthView({ session: { user: {} }, editor: undefined, recovering: true }),
    'recovering',
  );
  assert.equal(
    resolveAuthView({ session: { user: {} }, editor: false, recovering: true }),
    'recovering',
  );
});

test('resolveAuthView: recovering with no session is still signed-out — nothing to recover into', () => {
  assert.equal(resolveAuthView({ session: null, editor: undefined, recovering: true }), 'signed-out');
});

test('resolveAuthView: the editor lookup being in flight blocks, it does not pass', () => {
  assert.equal(
    resolveAuthView({ session: { user: {} }, editor: undefined, recovering: false }),
    'checking-editor',
  );
});

test('resolveAuthView: a failed or negative editor check is not-editor, never a silent pass', () => {
  assert.equal(
    resolveAuthView({ session: { user: {} }, editor: false, recovering: false }),
    'not-editor',
  );
});

test('resolveAuthView: authorized only once signed in, past recovery, and confirmed an editor', () => {
  assert.equal(
    resolveAuthView({ session: { user: {} }, editor: true, recovering: false }),
    'authorized',
  );
});
