import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanWord, cleanWords, wouldStop } from '../src/bannedWords.js';

test('a word is stored the way the table demands: trimmed and lower case', () => {
  assert.equal(cleanWord('  ASS '), 'ass');
  assert.equal(cleanWord('Đồ Ngu'), 'đồ ngu');
  assert.equal(cleanWord(null), '');
});

test('a box of typing adds each new word once, and nothing the list has', () => {
  assert.deepEqual(cleanWords(' Ass \n\nass\nBuy Followers\nfoo', ['foo']), ['ass', 'buy followers']);
  assert.deepEqual(cleanWords('', ['foo']), []);
  assert.deepEqual(cleanWords(null), []);
});

// The server's rule (`comment_clean`), mirrored: whole words, whatever the
// capitals and punctuation, and a phrase as a phrase.
test('a word stops a sentence only as a whole word', () => {
  const list = ['ass', 'buy followers', 'đồ ngu'];
  assert.deepEqual(wouldStop('What a class act', list), []);
  assert.deepEqual(wouldStop('ASS!', list), ['ass']);
  assert.deepEqual(wouldStop('you (ass)', list), ['ass']);
  assert.deepEqual(wouldStop('Buy   followers, now', list), ['buy followers']);
  assert.deepEqual(wouldStop('buy my followers', list), []);
  assert.deepEqual(wouldStop('Đồ ngu.', list), ['đồ ngu']);
  // Spelled apart gets by, as the migration says it does.
  assert.deepEqual(wouldStop('a.s.s', list), []);
  // Every word it has, in the list's order.
  assert.deepEqual(wouldStop('buy followers, ass', list), ['ass', 'buy followers']);
});

test('nothing typed and no list stop nothing', () => {
  assert.deepEqual(wouldStop('', ['ass']), []);
  assert.deepEqual(wouldStop(null, ['ass']), []);
  assert.deepEqual(wouldStop('ass', null), []);
});
