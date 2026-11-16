// How long a bio may be.
//
// 160, the figure a reader already knows from a profile elsewhere, and
// the one that keeps the paragraph short on the page it is read on: the
// About-me card sets it at 16pt beside the row's glyph, where 160
// Vietnamese characters come to about five lines on a 393pt screen
// (estimated from ~35 characters a line, not measured on a device). No
// "see more" is needed at five lines, which is the point of the number.
//
// Counted the way the field counts — `String.length`, UTF-16 units — so
// the counter under the field and the `maxLength` that stops the typing
// never disagree. An emoji costs two; that is the platform's arithmetic
// and a reader who hits it loses one character, not a sentence.
//
// The column has no check and gets none: bios longer than this were
// written before the limit, and they are still drawn whole. The limit is
// on what the field accepts from here on.
export const BIO_MAX = 160;
