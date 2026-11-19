// The banned-words list, as the desk types it and as the server reads it.
//
// `banned_words.word` has a CHECK: lower case, trimmed, not empty. A word
// that fails it is refused by the table with a message about a
// constraint, which is no way to be told about a capital letter — so the
// box is cleaned here first, the way the table would want it.
//
// ── how a word stops a comment, said once ──
//
// `comment_clean` (the comments migration) compares whole words: the
// comment and the banned word are both lower-cased, every run of spaces
// and punctuation becomes one space, and the word must then appear with
// a space on each side. So "ass" does not stop "class", "ASS!" is
// stopped, and a phrase of several words is matched as a phrase.
// `wouldStop` is the same rule for the page's try-it box, so the desk
// can see what a word will and will not catch before a reader finds out.
// It is a mirror, not the judge: the server decides, and this is kept
// honest by reading the same way, not by sharing code.

/** One entry, as the table stores it. */
export function cleanWord(raw) {
  return String(raw ?? '').trim().toLowerCase();
}

/**
 * What a box of typing adds: one word or phrase per line, cleaned,
 * without blanks, without repeats, and without what the list already has.
 */
export function cleanWords(text, have = []) {
  const seen = new Set(have);
  const out = [];
  for (const line of String(text ?? '').split('\n')) {
    const word = cleanWord(line);
    if (!word || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
  }
  return out;
}

// Postgres's [[:space:][:punct:]] for the text a comment holds: white
// space, and the ASCII punctuation class. Letters with marks and CJK are
// neither, so "đồ" and "映画" stay whole.
const BREAKS = /[\s!-/:-@[-`{-~]+/g;
const padded = (text) => ` ${String(text ?? '').toLowerCase().replace(BREAKS, ' ')} `;

/** The banned words a sentence would be stopped for, in list order. */
export function wouldStop(sentence, words) {
  const body = padded(sentence);
  return (words ?? []).filter((w) => body.includes(padded(w)));
}
