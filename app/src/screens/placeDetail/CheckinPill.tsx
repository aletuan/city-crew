// The Check-in pill on a place, the sheet the worn pill opens — the visits
// here, each with its own undo, and "again" when the rules allow it — and
// the note sheet that follows a tap (`useCheckIn`).
//
// Out of PlaceDetailScreen since 24 Nov 2026. The pill, its sheets and the
// state behind them were 13 of the screen's complexity, none of it read by
// anything else on the page: the screen decides only whether the pill is
// drawn (`place_checkin`). The lines were moved, not retyped. Both sheets
// are Modals, so drawing them from inside the score's row puts them where
// they always appeared.
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import ActionSheet, { type SheetAction } from '../../components/ActionSheet';
import { CountBadge, GradientCta, PressableScale } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import { useSession } from '../../lib/auth';
import { canRepeat, latestCheckin, visitsAt } from '../../lib/checkin';
import { useMyCheckins } from '../../lib/checkins';
import type { Place } from '../../lib/data';
import { clockOf, dateline } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useRemoveCheckin } from '../../lib/useRemoveCheckin';
import { colors } from '../../theme';
import { HISTORY_ROWS, s } from './styles';
import { useCheckIn } from './useCheckIn';

/** `name` and `cover` are what the note sheet shows of the place; `cityId`
 *  is the city a visit is filed under; `askToSignIn` is the screen's, so a
 *  guest's tap opens the same sheet the bookmark's does. */
export function CheckinPill({ place, name, cover, cityId, askToSignIn }: {
  place: Place;
  name: string;
  cover: string | null;
  cityId: string | null;
  askToSignIn: (why: 'checkin') => void;
}) {
  const { t, lang } = useI18n();
  // The door before the room: see `place_checkin` in `lib/flags`. For
  // everyone, guests included. It was the signed-in's only, on the
  // argument that a guest has nobody to check in as and the bookmark
  // already played the door-to-sign-in part here. The owner's review
  // (15 Oct 2026): a control that appears only after signing in is one
  // a guest never learns exists, and the bookmark and the like are both
  // drawn for guests and open the sign-in sheet on a tap. So this does
  // the same — see `checkIn`.
  const { session } = useSession();
  const uid = session?.user?.id ?? null;
  // The reader's visits — the one copy the whole app shares, so the
  // reload after a tap here is what the profile's count draws too.
  const visits = useMyCheckins();
  const removeVisit = useRemoveCheckin(visits.reload);
  const [checkinMenu, setCheckinMenu] = useState(false);
  const tap = useCheckIn({ uid, visits, askToSignIn });

  const latestVisit = latestCheckin(visits.data, place.slug);
  const visitsHere = visitsAt(visits.data, place.slug);
  // The tap, its refusals and the sheet that follows: `useCheckIn`.
  const checkIn = () => tap.checkIn({
    slug: place.slug, name, cover, cityId,
  });
  // Any one visit, not only the newest: the sheet lists them all, each
  // with its own undo, because the one that was a slip is not always
  // the last. The sheet stays open after one goes — the reader may be
  // tidying two — and closes itself only when the last goes, since a
  // sheet about a visit that no longer exists has nothing to show. No
  // "are you sure": the sheet is already the second step after the
  // pill, as the ⋯-then-sheet on the check-ins list was. The check-ins
  // list itself no longer offers the undo for a place that opens, so
  // this is the one place a visit is taken back (#831).
  const undoCheckin = async (id: string) => {
    if (visitsHere.length <= 1) setCheckinMenu(false);
    await removeVisit(id);
  };
  // "Again" is the sheet's one commit, so it is drawn as every sheet's
  // commit is — the wide gradient CTA under the history — and not as a
  // menu row among rows (the reference mock made it a filled card of
  // its own; the CTA is this app's filled card). Offered only while the
  // rules allow another — ten minutes since the last, fewer than three
  // today — because inside those a second tap is a slip, and the undo
  // for a slip is on its row above. Hidden rather than dimmed: the
  // sheet is most often opened in the minutes after a check-in, and a
  // big dimmed button there would read as a button that is broken.
  const canAgain = canRepeat(visits.data, place.slug, new Date());
  // Below it, what else a visit might lead to. The review is a door
  // drawn before its room, as the Check-in pill itself was (#812): the
  // owner wants the reader to learn that a visit will be rateable here,
  // and a row that says "coming soon" and refuses the tap teaches that
  // without pretending.
  const closeMenu = () => setCheckinMenu(false);
  const checkinActions: SheetAction[] = [{
    key: 'review', icon: 'create-outline' as const, disabled: true,
    title: t('Write a review', 'Viết đánh giá', 'レビューを書く', '写评价', '寫評價'),
    desc: t('Coming soon — share what it was like.', 'Sắp có — chia sẻ trải nghiệm của bạn.', '近日公開 — 感想を共有できます。', '即将推出 — 分享你的体验。', '即將推出 — 分享你的體驗。'),
    // Never called — a disabled row drops the press (`ActionSheet`). The
    // sheet's own close stands in for the handler the type asks for, so the
    // file holds no function that exists only to be skipped.
    onPress: closeMenu,
  }];

  return (
    <>
      {/* ── check-in ──
          A placeholder, drawn to be judged where it will live. It
          opened as the Directions pill — glass, hairline, accent
          type — and on the phone that read as a fourth fact: same
          fill, same hairline, same "coloured glyph and a word" as
          the chips to its left, with only the colour of the word to
          say otherwise. So it is a *bordered* button now, the way
          the filter row on Explore says "press me" with a bare
          outline where that row said "read me" with a glass fill;
          the outline is the accent at hairline
          strength. Not the tinted fill the mockup wore: the
          accent as a surface is for state (`theme.ts`), and a pill
          at rest is not one. *Having* checked in is the state, and
          the state wears a fill of its own — green, see "worn" below.

          ── the glyph: a ringed tick, hollow then filled ──

          The rest glyph was a filled pin, "one solid mark in a row
          of outlines", and the worn glyph a bare tick. The owner
          found the pin indistinguishable from the pin on the
          address row just below it and from the map tab at the
          foot of the screen — three pins on one screen, one of
          which is a verb. A pin says *where*; this control says
          *I was here*, which is what a tick in a ring says, on a
          form, on a passport stamp, on the owner's own reference
          (13 Oct 2026). Hollow at rest, filled once worn: the same
          glyph in its two states, the way the bookmark on the
          cover is `bookmark-outline` and then `bookmark`, so the
          eye reads one control changing rather than one control
          replaced. Pin-then-tick was two glyphs for one button.

          It sat at the right of the category pills until those
          moved onto the cover; it hangs at the right of the score
          now, the owner's reference having put it beside the name.
          Not beside the name: at `titleDetail` a name like "Off
          street fine coffee" already wraps, and a 110pt pill beside
          it would take a third of every name's line. The score's
          line is short on every place, so the pill costs it nothing.

          44 drawn (`FACT_HEIGHT`), the height it had as one of the
          chips and the target this app gives every control.

          Behind `place_checkin`, off as shipped, so the day it
          misleads it comes down on every phone without a build. */}
        <PressableScale
          // Rest: the tap is the visit. Worn: the tap is the menu —
          // again, or undo — so a slip never writes a second row.
          onPress={latestVisit ? () => setCheckinMenu(true) : () => { void checkIn(); }}
          disabled={tap.checking}
          haptic="selection"
          accessibilityRole="button"
          accessibilityState={{ selected: !!latestVisit, busy: tap.checking }}
          accessibilityLabel={latestVisit
            ? t('Visited — options', 'Đã qua — tuỳ chọn', '訪問済み — オプション', '已打卡 — 选项', '已打卡 — 選項')
            : t('Check in', 'Check-in', 'チェックイン', '打卡', '打卡')}
          style={s.checkinSlot}
          // ── worn ──
          // Filled once a visit is written, bare outline until then.
          // It was `accentSoft` first, and on the phone a 10% tint
          // inside a 28% hairline read as the same pill with the light
          // on it; then solid `accentFill`, which read as one more
          // coral ask. Green now (`okSoft` / `okInk`): a different hue
          // as well as a fill, so rest and worn are two things.
          //
          // The word changes for the same reason. "Check-in" and
          // "Checked in" (VI "Check-in" / "Đã check-in") share the
          // word that carries the meaning, so a glance read both as
          // the verb. "Visited" / "Đã qua" shares nothing with it,
          // and stays true months later, where "Checked in" read as
          // "you are here now". "Đã qua", not "Đã ghé" — the first
          // draft, borrowed from the Visited screen's "Bỏ lần ghé
          // này"; the owner read "Đã qua" as the better word.
          //
          // The rest label is a verb because a button is one: "Check
          // in", not the noun. Vietnamese has no such split and keeps
          // "Check-in".
          contentStyle={[s.checkin, latestVisit && s.checkinOn]}
          testID={latestVisit ? 'detail-checked-in' : 'detail-checkin'}
        >
          <Glyph name={latestVisit ? 'checkmark-circle' : 'checkmark-circle-outline'} size={ICON.text} color={latestVisit ? colors.okInk : colors.accent} />
          {/* ── one width in both states ──
              The pill was as wide as its word, and the two words
              are not the same length: "Check-in" and "Đã qua" are
              8 and 6 characters, so on the phone the pill shrank
              by about 18pt on the tap and grew back on the undo.
              The owner read that as the control breathing.

              So the label is a column holding both words: the one
              being shown, and the other at zero height, invisible
              and hidden from VoiceOver. A column is as wide as its
              widest child, so the pill is the width of the longer
              word whichever is showing, and the shown word sits
              centred in that width under the glyph. Measured, not
              fixed: a `minWidth` would be a number for one
              language and one type size, and the ghost word is
              right in all three languages and at every Dynamic
              Type step, because it is the other word itself. */}
          <View style={s.checkinWords}>
            <Text style={[s.goText, latestVisit && s.checkinOnText]}>
              {latestVisit ? t('Visited', 'Đã qua', '訪問済み', '已打卡', '已打卡') : t('Check in', 'Check-in', 'チェックイン', '打卡', '打卡')}
            </Text>
            <Text
              style={[s.goText, s.checkinGhost]}
              aria-hidden
              importantForAccessibility="no-hide-descendants"
              testID="detail-checkin-ghost"
            >
              {latestVisit ? t('Check in', 'Check-in', 'チェックイン', '打卡', '打卡') : t('Visited', 'Đã qua', '訪問済み', '已打卡', '已打卡')}
            </Text>
          </View>
        </PressableScale>

      {/* The worn pill's sheet: the history of visits here, newest
          first, each in the reader's own date format with its own undo
          on the right, and "again" below when the rules allow it. The
          list scrolls past HISTORY_ROWS rows rather than growing the
          sheet off the top of the screen — three a day for a regular
          adds up — and the count in the header says when it does. */}
      {latestVisit && (
        <ActionSheet
          visible={checkinMenu}
          onClose={closeMenu}
          actions={checkinActions}
          header={(
            <View style={s.checkinHead}>
              {/* The count is the Profile's pill at the row's end, not a
                  line of words under the title: one shape for "how many"
                  across the app, and 20pt of sheet given back. Inset by
                  the history card's padding so it stands on the trash
                  column's axis below. */}
              <View style={s.checkinHeadRow} testID="checkin-head">
                <Text style={s.checkinHeadTitle}>{t('Checked in here', 'Bạn đã check-in ở đây', 'ここにチェックイン済み', '你在这里打过卡', '你在這裡打過卡')}</Text>
                <CountBadge n={visitsHere.length} style={s.checkinCount} />
              </View>
              <ScrollView style={s.history} bounces={false} showsVerticalScrollIndicator={visitsHere.length > HISTORY_ROWS}>
                {visitsHere.map((v, i) => {
                  const d = new Date(v.at);
                  return (
                    <View key={v.id} style={[s.historyRow, i > 0 && s.historyDivider]} testID="checkin-visit">
                      <Glyph name="time-outline" size={ICON.action} color={colors.textTertiary} />
                      <Text style={s.historyText} numberOfLines={1}>
                        {dateline(lang, d)} · {clockOf(d.getHours() * 60 + d.getMinutes())}
                      </Text>
                      <PressableScale
                        onPress={() => { void undoCheckin(v.id); }}
                        // One id for every row's trash: a flow tidying up
                        // taps the first until the sheet closes itself.
                        testID="checkin-visit-remove"
                        scaleTo={0.85}
                        hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel={t('Remove this visit', 'Bỏ lần ghé này', 'この訪問を削除', '删除这次打卡', '刪除這次打卡')}
                      >
                        <Glyph name="trash-outline" size={ICON.action} color={colors.bad} />
                      </PressableScale>
                    </View>
                  );
                })}
              </ScrollView>
              {canAgain && (
                <GradientCta
                  wide
                  icon="location"
                  label={t('Check in again', 'Check-in lần nữa', 'もう一度チェックイン', '再次打卡', '再次打卡')}
                  onPress={() => { setCheckinMenu(false); void checkIn(); }}
                  testID="detail-checkin-again"
                />
              )}
            </View>
          )}
        />
      )}
      {tap.sheet}
    </>
  );
}
