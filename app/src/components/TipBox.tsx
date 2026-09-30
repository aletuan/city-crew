// One tip under the title, a different one each visit.
//
// The screen says which tips apply to what the reader is looking at, and
// which of their moves have been made on this visit. This box asks
// `lib/tips` which one is due, shows it, and keeps the record on the
// device (see there for why in turn and not at random, and when a tip
// retires).
//
// One tip per visit, chosen once. A tip that changed while the reader was
// reading it would be a box that cannot be read. It goes when it stops
// being true (the list it said was private has just been made public),
// when it is closed, or when the reader leaves. A tip whose move has just
// been made retires for the next visit but stays for this one: pulling it
// out from under the finger that did it would shift every card up.
//
// Nothing is shown until storage has answered, so a tip that was closed
// never flashes. A store that cannot be read shows nothing at all: a tip
// whose ✕ cannot be remembered is one that comes back after every close.

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useI18n } from '../lib/i18n';
import {
  LEGACY_REORDER_KEY, markShown, parseLog, pickTip, retire, tipsKey, type TipId, type TipLog,
} from '../lib/tips';
import { colors, radius, space, type } from '../theme';
import { PressableScale } from './ui';

type T = (en: string, vi: string, ja: string) => string;

/**
 * The one glyph every tip wears.
 *
 * One, not one per tip. The glyph's job is to say what kind of box this
 * is, and since the word "Tip" came off the front of the text it says so
 * alone: the word and the glyph said the same thing twice, and the word
 * took the first line's best room. The first build gave
 * each tip the glyph of the control it pointed to, and they read as
 * controls: a bookmark in the add tip sitting just above the real
 * bookmark on a card, and a pencil that looked like the edit button
 * itself. Nothing happens when either is tapped.
 *
 * The light bulb, the usual mark for a tip (Apple's Tips, Material's
 * `tips_and_updates`). Once the word was gone the glyph had to say "tip"
 * on its own, and the bulb is the one a reader already knows.
 *
 * Rejected: the circled "i", which was here first. It says "a note", not
 * "a tip", and in the accent on the accent's soft ground it read as an
 * alert: "this list is private" under it sounded like something wrong.
 * The bulb was passed over at first because it is also the Ideas tab's
 * glyph and might read as a way there. It did not weigh much: the box is
 * not a button, and an idea and a tip are near enough in meaning that
 * sharing a glyph costs little. Not sparkles, which stand for suggestions
 * in Explore and Trips.
 */
const TIP_ICON = 'bulb-outline' as const;

/** What each tip says.
 *
 *  The menu is named by where it is and what it looks like, "the three-dot
 *  button (⋯) at the top right", not by the glyph alone. A bare "⋯" in a
 *  sentence read as an ellipsis, a gap in the text rather than a button to
 *  go and find. The glyph stays in brackets so the eye can match it. */
const TIPS: Record<TipId, (t: T) => string> = {
  reorder: (t) => t(
    'Hold a place, then drag it to change the order. Changes save on their own.',
    'Giữ một địa điểm rồi kéo để đổi thứ tự. Thay đổi được lưu tự động.',
    'スポットを長押ししてドラッグすると並び順を変えられます。変更は自動で保存されます。',
  ),
  publish: (t) => t(
    'This list is private. Tap the three-dot button (⋯) at the top right and choose Make public so anyone can see it.',
    'Bộ sưu tập này đang riêng tư. Bấm nút ba chấm (⋯) ở góc trên bên phải rồi chọn Công khai để ai cũng xem được.',
    'このコレクションは非公開です。右上の「⋯」ボタンから「公開する」を選ぶと、誰でも見られます。',
  ),
  edit: (t) => t(
    'To rename it or change the description, tap the three-dot button (⋯) at the top right and choose Edit collection.',
    'Muốn đổi tên hay mô tả? Bấm nút ba chấm (⋯) ở góc trên bên phải rồi chọn Sửa bộ sưu tập.',
    '名前や説明を変えるには、右上の「⋯」ボタンから「コレクションを編集」を選びます。',
  ),
  add: (t) => t(
    'Tap the bookmark on any place card to save it here, or tap the three-dot button (⋯) at the top right and choose Add place.',
    'Bấm dấu trang trên thẻ địa điểm ở bất kỳ đâu để lưu vào đây, hoặc bấm nút ba chấm (⋯) ở góc trên bên phải rồi chọn Thêm địa điểm.',
    'スポットカードのしおりをタップするとここに保存できます。右上の「⋯」ボタンの「スポットを追加」からも追加できます。',
  ),
  copy: (t) => t(
    'Like this list? Tap the three-dot button (⋯) at the top right and choose Save a copy to get your own version to change as you like.',
    'Thích danh sách này? Bấm nút ba chấm (⋯) ở góc trên bên phải rồi chọn Lưu bản sao để có một bản của riêng bạn và chỉnh theo ý mình.',
    'このリストが気に入ったら、右上の「⋯」ボタンの「コピーを保存」で自分用に編集できるコピーを作れます。',
  ),
};

/**
 * Every tip back, for one reader: Profile's "Show tips again". Forgets
 * the reader's record, and the old reorder flag too, which would otherwise
 * retire that tip again on the next read. The next visit to a list starts
 * from the first tip that applies, as a first visit does.
 */
export async function resetTips(reader: string | null | undefined): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(tipsKey(reader)),
    AsyncStorage.removeItem(LEGACY_REORDER_KEY),
  ]);
}

export default function TipBox({ eligible, done, reader }: {
  /** The tips true of what is on screen, in the order to offer them. */
  eligible: readonly TipId[];
  /** Moves made on this visit: their tips retire. */
  done: readonly TipId[];
  /** Whose record this is: an account id, or nothing for a guest. See
   *  `tipsKey`. The screen remounts the box when it changes. */
  reader?: string | null;
}) {
  const { t } = useI18n();
  const key = tipsKey(reader);
  // Undefined while storage is out; null when it could not be read.
  const [log, setLog] = useState<TipLog | null | undefined>(undefined);
  // Undefined until a tip is chosen for this visit; null for "none due".
  const [shown, setShown] = useState<TipId | null | undefined>(undefined);
  const [closed, setClosed] = useState(false);
  // The record as last written, for the effects below that change it one
  // step at a time without waiting a render to see each other's steps.
  const record = useRef<TipLog | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([AsyncStorage.getItem(key), AsyncStorage.getItem(LEGACY_REORDER_KEY)])
      .then(([raw, legacy]) => {
        if (!live) return;
        record.current = parseLog(raw, legacy);
        setLog(record.current);
      })
      .catch(() => { if (live) setLog(null); });
    return () => { live = false; };
  }, [key]);

  const write = (next: TipLog) => {
    record.current = next;
    setLog(next);
    AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
  };

  // Chosen once, as soon as there is a record and something applies. The
  // screen's list arrives after the record often enough that "something
  // applies" has to be waited for rather than read on the first pass.
  const hasEligible = eligible.length > 0;
  useEffect(() => {
    if (!log || shown !== undefined || !hasEligible) return;
    const id = pickTip(eligible, log);
    setShown(id);
    if (id) write(markShown(log, id));
  // `eligible` is read, not watched: once a tip is chosen nothing re-picks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, shown, hasEligible]);

  const doneKey = done.join(',');
  useEffect(() => {
    let next = record.current;
    if (!next) return;
    for (const id of done) next = retire(next, id);
    if (next !== record.current) write(next);
  // `doneKey` is `done`, as something an effect can compare.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKey, log]);

  if (!shown || closed || !eligible.includes(shown)) return null;
  return (
    <View style={s.tip} accessibilityRole="summary" testID={`tip-${shown}`}>
      <Ionicons name={TIP_ICON} size={18} color={colors.accent} style={s.icon} />
      {/* The word is gone from the screen but not from VoiceOver, which
          does not read the glyph: without it a tip is heard as one more
          sentence of the page. "Tip" in the Vietnamese too, not "Mẹo",
          the word the Profile row that brings them back uses ("Hiện lại
          các tip"). */}
      <Text style={s.text} accessibilityLabel={`${t('Tip', 'Tip', 'ヒント')}: ${TIPS[shown](t)}`}>
        {TIPS[shown](t)}
      </Text>
      <PressableScale
        onPress={() => {
          setClosed(true);
          if (record.current) write(retire(record.current, shown));
        }}
        haptic="selection"
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('Dismiss tip', 'Ẩn tip', 'ヒントを閉じる')}
      >
        <Ionicons name="close" size={18} color={colors.textTertiary} />
      </PressableScale>
    </View>
  );
}

const s = StyleSheet.create({
  // The banner's shape — a soft card the width of the page — in the
  // accent's own soft ground, so it reads as the app talking rather than
  // as one more place.
  tip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginHorizontal: space.page, marginBottom: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: radius.input, backgroundColor: colors.accentSoft,
  },
  icon: { marginTop: 1 },
  text: { flex: 1, color: colors.text, ...type.meta, lineHeight: 21 },
});
