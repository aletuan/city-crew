// The paragraph about a place, and whose words it is.
//
// Out of PlaceDetailScreen since 24 Nov 2026: the blurb and its credit
// were 24 of the screen's complexity — every "is there a source, does it
// link, does it have a mark, is it in the reader's language" a branch of
// the screen's one function. They are one unit on the page (the desk's
// reading of the place) and one here. The lines were moved, not retyped.
import { Text, View } from 'react-native';
import { Card, PressableScale } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import { blurbCredit, blurbIcon, blurbLink } from '../../lib/blurbSource';
import type { Place } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { localized, localizedLang } from '../../lib/localized';
import { colors } from '../../theme';
import { openLink } from './InfoCard';
import { s } from './styles';

/** Nothing when the place has no paragraph in a language the reader can
 *  be given: the card is drawn only around words. */
export function BlurbCard({ place }: { place: Place }) {
  const { t, lang } = useI18n();
  // Asked of the string the reader will actually get, not of the columns:
  // a description written only in Japanese is one for a Japanese reader,
  // and nothing (rather than an empty paragraph) for everyone else.
  const desc = localized(place, 'desc', lang);
  // The language those words are in, when it is not the reader's. 837 of
  // 940 places had no Japanese blurb on 13 Oct 2026 and `t` fell back to
  // English on every one of them without a word, so a Japanese reader
  // could not tell a catalog written in English from a broken one. Named
  // under the paragraph, in the reader's language: a fallback that says
  // so is a choice; one that does not is a defect. Only the blurb — a
  // café's name is its name in any language, and the district falls back
  // on every card already, where a label would be noise. And not for an
  // English reader: English is the language the catalog is written in,
  // and the one case where it is missing (a Vietnamese-only blurb, 96
  // rows) is the desk's to fill, not the reader's to be told about.
  // A Vietnamese reader can only be handed English; a Japanese one,
  // English or Vietnamese — so two labels cover every fallback there is.
  const descLang = localizedLang(place, 'desc', lang);
  const descFallback = desc && lang !== 'en' && descLang && descLang !== lang
    ? (descLang === 'en'
      ? t('In English', 'Bản tiếng Anh', '英語の原文', '英文原文', '英文原文')
      : t('In Vietnamese', 'Bản tiếng Việt', 'ベトナム語の原文', '越南文原文', '越南文原文'))
    : null;
  // Who wrote the sentence above it. Null for most places — the desk wrote
  // its own copy, and there is nobody outside to name.
  const blurbFrom = blurbCredit(place);
  const blurbHref = blurbLink(place);
  const blurbMark = blurbFrom && blurbIcon(blurbFrom);
  // Only the credit opens the source (owner, 17 Oct 2026). The paragraph
  // shared the handler until then, on the reading that words and credit
  // are one quote and a thumb takes whichever is nearer; in use, a thumb
  // resting on the words while reading — or starting a scroll on them —
  // was thrown into Threads. The paragraph is for reading, and the name
  // in the link colour is the one thing that says "this goes somewhere".
  const openBlurb = blurbHref
    ? () => openLink(blurbHref, t('Could not open the source', 'Không mở được nguồn', 'ソースを開けませんでした', '无法打开来源', '無法開啟來源'))
    : undefined;
  // The credit's words: the handle under a mark, the platform alone for
  // Google, and the long form for a source with no mark (see the block).
  const creditWords = !blurbFrom ? '' : blurbFrom.kind === 'threads'
    ? (blurbFrom.name ?? 'Threads')
    : blurbFrom.kind === 'google'
      ? 'Google'
      : (blurbFrom.name
        ? t(`${blurbFrom.name} on ${blurbFrom.source}`, `${blurbFrom.name} trên ${blurbFrom.source}`, `${blurbFrom.name}（${blurbFrom.source}）`, `${blurbFrom.name}（${blurbFrom.source}）`, `${blurbFrom.name}（${blurbFrom.source}）`)
        : blurbFrom.source);
  // What VoiceOver says for it: the mark it cannot read, put back in words
  // where the line names a person rather than the platform itself.
  const creditLabel = blurbFrom?.kind === 'threads' && blurbFrom.name
    ? t(`${creditWords} on Threads`, `${creditWords} trên Threads`, `${creditWords}（Threads）`, `${creditWords}（Threads）`, `${creditWords}（Threads）`)
    : creditWords;
  const creditLine = blurbFrom ? (
    <Text style={[s.credit, blurbHref ? s.creditLink : null]}>
      {blurbMark ? (
        <Glyph name={blurbMark} size={ICON.meta} color={blurbHref ? colors.accent : colors.textTertiary} />
      ) : null}
      {blurbMark ? ' ' : ''}
      {creditWords}
    </Text>
  ) : null;
  if (!desc) return null;

  return (
    <>
    {/* ── highlights ── */}
    {/* Unlabelled, the description read as boilerplate and got
        skimmed; named, it is the paragraph a reader stops for.

        "Highlights", not "Why go?", which was the first label. A
        question waits for an opinion, and it was written when the
        desk wrote every line. It no longer does: of 103 published
        descriptions, 54 are Google's `editorialSummary`, a neutral
        line signed by nobody ("seasonal tasting menus and a robust
        wine list"), and under "Why go?" that read as an answer
        nobody gave. What Google writes and what the desk writes
        are both the place at its best, and that is what the label
        now says. Whose words they are is the credit line's job.

        Rejected, with what ruled them out:
        - "Reviews" (Đánh giá): the rating directly above already
          says "1.8k đánh giá", and this would read as those.
        - "Our take" (Nhận xét): still an opinion, so still wrong
          for Google's lines, and close to a user comment.
        - "Overview" (Thông tin cơ bản): the voice of the address
          and hours below, and it leaves the quotation mark
          beside it with nothing to mark.
        - "About" (Giới thiệu): true of every source, but flat.
        - One label per source: honest, but the same block
          changing its name from place to place is a thing to
          explain, and the credit line already tells them apart.

        No chevron. There is no fuller version to open, and an arrow
        that leads nowhere is a promise the screen cannot keep. */}
    {/* ── one card for the desk's words and the desk's tags ──
        Since 14 Oct 2026 the paragraph and the vibe chips sit in a
        `Card`, the same surface the address and hours below wear
        (`surfaceCard`), so the screen has two grounds and no more:
        the page, and the cards on it. Grouping the two was the
        owner's ask — the blurb and the chips are one unit, the
        desk's reading of the place, and the facts below are
        another. Rejected, with what ruled them out:
        - a tint of the accent, as in the mockup: `theme.ts` keeps
          the accent as a surface for state the reader made, and
          this would be the largest accent surface in the app under
          something that is not one; the check-in pill above tried
          `accentSoft` and read as "the same pill with the light on
          it".
        - the theme's glass (`surfaceGlass`): one step off the cards
          below, so three grounds on one screen where the owner
          wanted fewer colours, not more.
        Drawn only when there is a paragraph. The first cut drew it
        for a tag alone too, and on the phone a card holding one chip
        read as a box inside a box — and that is the common case,
        not the edge: 720 of 940 live places had no blurb on 14 Oct
        2026. Without a paragraph the chips stand bare, as they did
        before the card. The chips keep the glass inside the card,
        5% over the card's own ground.

        Since 15 Oct 2026 the card holds the paragraph alone: the
        vibe chips left this screen (see "what the place is"). */}
    <Card style={s.whyCard} testID="detail-why-card">
      <View style={s.why} testID="detail-why">
        {/* A quotation mark, not a speech bubble. A bubble is what
            somebody else said — a review, a comment, a message — and
            this is the desk's own sentence about the place. The mark
            that means "these are words somebody chose" is the one
            printers have used for that since before there were
            screens.

            A character rather than an icon because Ionicons has no
            quote glyph; `“` is in the display face, which the
            headings on this screen already use.

            No nudge. Space Grotesk draws its quotes low enough that
            centring the line box centres the ink to within 0.3pt of
            the disc's middle — measured off the font, at 22pt in a
            28pt disc. */}
        {/* ── the heading on a line of its own, since 12 Oct 2026 ──
            The mark used to sit in a gutter with the label *and the
            paragraph* beside it, so the paragraph was the one thing on
            the screen 40pt (a 28pt disc and its gap) in from the left
            edge the name, the info card and the map share. The owner
            asked for the paragraph on its own line, full width. One
            left edge for the screen, and at 16pt a line ~5 characters
            longer: a 120-character blurb goes from four lines to
            three or so. The mark keeps its meaning — it is still the
            quotation mark over these words, not a section icon — but
            not its disc: the disc was the gutter's anchor for a
            column of text, and on a heading row a bare mark in the
            display face reads as a magazine's opening quote, which
            is what the owner asked for on seeing it with the disc.
            The pick mark sat at the right of this row until 14 Oct
            2026; it is over the name now (see "City Crew pick"). */}
        <View style={s.whyHead}>
          <Text style={s.whyQuote}>{'\u201C'}</Text>
          <Text style={s.whyLabel}>{t('Highlights', 'Điểm nổi bật', '見どころ', '亮点', '亮點')}</Text>
        </View>
        <View style={s.whyBody}>
          <Text style={s.desc} testID="detail-desc">{desc}</Text>
          {/* Whose words those are, on a line of their own under
              them, starting at the paragraph's left edge (owner, 17
              Oct 2026). From 12 Oct it was the paragraph's last run,
              after two spaces — a pull quote's attribution, on the
              reading that a line of its own broke the paragraph's
              rhythm. On the phone the run wrapped wherever the
              sentence happened to end, and the mark could be left at
              the end of one line with the name alone on the next: a
              stray glyph, and a name with no platform. On its own
              line the two are never parted, and the press is the
              line alone (see `openBlurb`).

              After the blurb rather than before it because the
              sentence is what the reader came for; the attribution
              answers a question they only have once they have read
              it. At 15pt against the paragraph's 16, in the link
              colour when it goes somewhere — one step down says
              "attribution", two said "footnote".

              Google is credited by platform alone. The import copies
              `editorialSummary`, which Google writes and signs with
              nobody, so there is no author to name and naming one
              would be an invention. Threads has a person, and that
              person is the reason the copy is good.

              Plain text when there is nowhere to go: a tappable line
              that does nothing is worse than an untappable one.

              The platform's mark leads the line, and once it is there
              the words stop naming the platform: "gowithchinne" under
              the Threads glyph says what "@gowithchinne on Threads"
              said, in a third of the line. The @ goes with them — it
              is a second marker for the thing the glyph already
              marks. The glyph rides inside the Text and takes its
              baseline, which is what makes a glyph beside words read
              as one line rather than two objects. VoiceOver cannot
              read a glyph, so the label says the platform the glyph
              shows. A source with no mark keeps the long wording;
              there is nothing else to carry it. */}
          {creditLine && (openBlurb ? (
            <PressableScale
              contentStyle={s.creditRow}
              scaleTo={0.97}
              // The line is 19pt tall and as wide as a handle; this
              // makes it a 44pt target without drawing one.
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 16 }}
              onPress={openBlurb}
              accessibilityRole="link"
              accessibilityLabel={creditLabel}
              testID="blurb-credit"
            >
              {creditLine}
            </PressableScale>
          ) : (
            <View style={s.creditRow} accessibilityLabel={creditLabel} testID="blurb-credit">
              {creditLine}
            </View>
          ))}
          {descFallback ? (
            <Text style={s.descFallback} testID="blurb-fallback">{descFallback}</Text>
          ) : null}
        </View>
      </View>

    </Card>
    </>
  );
}
