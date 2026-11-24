// The sheet over a visit: a few words about it, and who sees it
// (owner, 24 Nov 2026).
//
// ── when it comes up ──
//
// Twice. Straight after the tap that checked in — `fresh` — over a visit
// that is already written (`lib/checkin` says why the tap still writes
// it and the sheet follows): it says so, with the tick, and leaves the
// field under the thumb. And later, from the reader's own visit, to
// write the note it does not have or change the one it does.
//
// ── how it goes away ──
//
// Fresh, every way out keeps what is in it: Done, the dim, the back
// gesture. The visit exists either way, so there is nothing to cancel,
// and a reader who typed a line and tapped outside meant to be finished,
// not to throw the line away. Writing nothing is an answer too.
//
// Editing, the dim and the back gesture leave the visit as it was and
// Save is the one way to change it — every form's rule here, because
// now there *is* something to put back.
//
// A save that fails keeps the sheet up with the words in it and says so:
// closing over a failure would lose a line the reader cannot see was
// lost.
//
// ── who sees it ──
//
// Two answers, Only me and Friends (`Audience`); never everyone. Drawn
// when the caller asks (`withAudience`), which every caller has since
// friends had somewhere to see a visit — `AUDIENCE_ON` in `lib/checkin`.
// Without it nothing is written about who sees the visit.
//
// A fresh sheet opens on the reader's last answer (`nextAudience`) and
// writes the answer as it closes, changed or not: that write is what
// first lets a friend see the visit. An old visit opens on its own
// answer — private, if it was never asked — and is written only if the
// reader changes it: adding a note to last month's visit must not share
// it.
//
// ── the field ──
//
// Not focused as a fresh sheet rises: most visits get no words, and a
// keyboard thrown over the place the reader just checked in at, for a
// line they did not ask to write, is the sheet-before-the-visit's cost
// paid anyway. Focused when the reader came to edit — that press was
// the request. Either way the sheet rides the keyboard on `useRide`
// (`CommentQuick`), the same native-driver lift the quick comment field
// takes and for its reason: a `KeyboardAvoidingView` inside a `Modal`
// moves a beat after the keyboard.
//
// ── what moves ──
//
// The sheet rises on the spring every sheet here rises on, and on a
// fresh visit the tick lands once as it does. The visit's own haptic was
// the tap's (`successHaptic`, on the place's screen); Done has the light
// press every button has. Nothing else: no confetti, and the badges and
// the banner a visit can earn are where they were. Reduce Motion takes
// the rise and the tick's landing both and leaves the dim's fade.

import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cleanNote, NOTE_MAX, type Audience } from '../lib/checkin';
import { saveCheckin } from '../lib/data';
import { numericDate } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { SEEN_GLYPH } from '../lib/shares';
import { colors, display, font, space } from '../theme';
import { useRide } from './CommentQuick';
import Segmented from './Segmented';
import { GradientCta, useReducedMotion } from './ui';
import { Glyph, ICON } from './ui/glyph';

/** The visit the sheet is over. */
export type SheetVisit = {
  id: string;
  /** The place's name, in the reader's language. */
  name: string;
  cover?: string | null;
  /** ISO instant of the visit. */
  at: string;
  note: string | null;
  /** The answer the control opens on: the visit's own, or for a fresh
   *  one the reader's last (`nextAudience`). */
  audience: Audience;
  /** Raised by the check-in itself, a moment ago. */
  fresh: boolean;
};

/** The count is drawn from here up: the last forty characters, where it
 *  is news. Under that a counter is a meter on a remark. */
const COUNT_FROM = NOTE_MAX - 40;
/** How far down the sheet starts its rise: its own height at most
 *  (head 44, field 96, control and gloss 74, button 52, the gaps and the
 *  insets), so it comes from under the screen's foot and not from mid-air. */
const RISE = 360;

export default function CheckinSheet({ visit, onClose, withAudience = false }: {
  visit: SheetVisit | null;
  /** `saved`: something was written, and the visits want asking again.
   *  `shared`: what was written made (or kept) the visit one friends see. */
  onClose: (saved: boolean, shared?: boolean) => void;
  withAudience?: boolean;
}) {
  // Android's back is a way out like the dim, and what the dim does is
  // the body's to say: it holds the words.
  const backRef = useRef(() => {});
  return (
    <Modal visible={visit !== null} transparent animationType="fade" onRequestClose={() => backRef.current()} statusBarTranslucent>
      {/* Keyed by the visit, so the words typed over one are never the
          field's opening state over the next. */}
      {visit ? <Body key={visit.id} visit={visit} onClose={onClose} withAudience={withAudience} backRef={backRef} /> : null}
    </Modal>
  );
}

function Body({ visit, onClose, withAudience, backRef }: {
  visit: SheetVisit; onClose: (saved: boolean, shared?: boolean) => void; withAudience: boolean;
  backRef: React.MutableRefObject<() => void>;
}) {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const ride = useRide(insets.bottom);
  const still = useReducedMotion();
  const [text, setText] = useState(visit.note ?? '');
  const [audience, setAudience] = useState<Audience>(visit.audience);
  const [busy, setBusy] = useState(false);

  // 1 → 0: the sheet up from under the foot, and the tick from small.
  const rise = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (still) { rise.setValue(0); return; }
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [rise, still]);

  const keep = async () => {
    if (busy) return;
    const note = cleanNote(text);
    // What there is to write. The words, when they changed. Who sees it,
    // when that is asked and either the answer changed or the visit is
    // fresh — closing a fresh sheet *is* the answer, the one that lets a
    // friend see the visit at all, so it is written even unchanged.
    const said = note !== visit.note;
    const answered = withAudience && (visit.fresh || audience !== visit.audience);
    if (!said && !answered) { onClose(false); return; }
    setBusy(true);
    try {
      await saveCheckin(visit.id, answered ? { note, audience } : { note });
      onClose(true, answered && audience === 'friends');
    } catch (e) {
      setBusy(false);
      Alert.alert(
        t('Could not save your note', 'Không lưu được ghi chú', 'メモを保存できませんでした', '无法保存备注', '無法儲存備註'),
        (e as Error).message,
      );
    }
  };
  // The ways out that are not the button — see the header.
  const leave = () => { if (visit.fresh) void keep(); else onClose(false); };
  useEffect(() => { backRef.current = leave; });

  const gloss = audience === 'friends'
    ? t('Your friends see the place, the day and your note.', 'Bạn bè thấy địa điểm, ngày ghé và ghi chú của bạn.', '友達には場所・日付・メモが表示されます。', '好友可以看到地点、日期和你的备注。', '好友可以看到地點、日期和你的備註。')
    : t('Nobody else sees this visit.', 'Không ai khác thấy lần ghé này.', 'この訪問は他の人には表示されません。', '其他人看不到这次打卡。', '其他人看不到這次打卡。');

  return (
    <>
      <Pressable
        style={s.backdrop}
        onPress={leave}
        accessibilityLabel={t('Close', 'Đóng', '閉じる', '关闭', '關閉')}
        testID="checkin-sheet-close"
      />
      <View style={s.dock} pointerEvents="box-none">
        <Animated.View style={{ transform: [{ translateY: ride }] }}>
          <Animated.View
            style={[s.sheet, {
              paddingBottom: insets.bottom + 16,
              transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, RISE] }) }],
            }]}
            testID="checkin-sheet"
          >
            <View style={s.grabber} />
            <View style={s.head}>
              <View style={s.thumb}>
                {visit.cover ? (
                  <Image source={{ uri: visit.cover }} style={s.thumbImage} contentFit="cover" aria-hidden />
                ) : (
                  <Glyph name="location-outline" size={ICON.action} color={colors.textTertiary} />
                )}
              </View>
              <View style={s.headText}>
                <Text style={s.name} numberOfLines={1} testID="checkin-sheet-name">{visit.name}</Text>
                {visit.fresh ? (
                  <View style={s.doneRow} testID="checkin-sheet-done">
                    <Animated.View style={[s.tick, { transform: [{ scale: rise.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) }] }]}>
                      <Glyph name="checkmark" size={ICON.tiny} color={colors.okInk} />
                    </Animated.View>
                    <Text style={s.doneText}>{t('Checked in', 'Đã check-in', 'チェックイン済み', '已打卡', '已打卡')}</Text>
                  </View>
                ) : (
                  <Text style={s.when} testID="checkin-sheet-when">{numericDate(lang, new Date(visit.at))}</Text>
                )}
              </View>
            </View>

            <View style={s.well}>
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                autoFocus={!visit.fresh}
                maxLength={NOTE_MAX}
                placeholder={t('What did you think of this place?', 'Bạn nghĩ gì về nơi này?', 'この場所はどうでしたか？', '你觉得这里怎么样？', '你覺得這裡怎麼樣？')}
                placeholderTextColor={colors.textTertiary}
                style={s.input}
                accessibilityLabel={t('A note about this visit', 'Ghi chú về lần ghé này', 'この訪問のメモ', '这次打卡的备注', '這次打卡的備註')}
                testID="checkin-sheet-note"
              />
              {text.length >= COUNT_FROM ? (
                <Text style={s.count} testID="checkin-sheet-count">{`${text.length}/${NOTE_MAX}`}</Text>
              ) : null}
            </View>

            {withAudience ? (
              <View style={s.seen}>
                <Segmented
                  items={[
                    { key: 'private' as const, label: t('Only me', 'Chỉ mình tôi', '自分のみ', '仅自己', '僅自己'), icon: SEEN_GLYPH.private, testID: 'checkin-sheet-seen-private' },
                    { key: 'friends' as const, label: t('Friends', 'Bạn bè', '友達', '好友', '好友'), icon: SEEN_GLYPH.friends, testID: 'checkin-sheet-seen-friends' },
                  ]}
                  chosen={audience}
                  onPick={setAudience}
                  label={t('Who can see this visit?', 'Ai có thể thấy lần ghé này?', 'この訪問を見られる人', '谁可以看到这次打卡？', '誰可以看到這次打卡？')}
                  said={gloss}
                  testID="checkin-sheet-seen"
                />
                <Text style={s.gloss} testID="checkin-sheet-gloss">{gloss}</Text>
              </View>
            ) : null}

            <GradientCta
              wide
              busy={busy}
              label={visit.fresh ? t('Done', 'Xong', '完了', '完成', '完成') : t('Save', 'Lưu', '保存', '保存', '儲存')}
              onPress={() => { void keep(); }}
              testID="checkin-sheet-save"
            />
          </Animated.View>
          {/* The sheet's ground carried on under the keyboard's rounded
              corners, as the quick comment field's is. */}
          <View style={s.under} pointerEvents="none" />
        </Animated.View>
      </View>
    </>
  );
}

/** The cover's side: 44, a face's on a sheet's head (`FriendPicker`'s
 *  rows were), radius 10 — the check-ins list's 56:12, a step down for a
 *  line that names the visit rather than being the row. */
const THUMB = 44;

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.62)' },
  dock: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
  sheet: {
    paddingHorizontal: space.page, paddingTop: 10, gap: 14,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
  },
  // Far taller than any keyboard, and hung under the sheet rather than
  // counted in its height.
  under: { position: 'absolute', left: 0, right: 0, top: '100%', height: 600, backgroundColor: colors.bgElevated },
  grabber: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: colors.textTertiary },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headText: { flex: 1, gap: 2 },
  thumb: {
    width: THUMB, height: THUMB, borderRadius: 10, overflow: 'hidden',
    backgroundColor: colors.surfaceGlassStrong, alignItems: 'center', justifyContent: 'center',
  },
  thumbImage: { width: THUMB, height: THUMB },
  name: { color: colors.text, fontSize: 18, fontFamily: display.semibold },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tick: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.okSoft, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: colors.okInk, fontSize: 14, fontWeight: font.semibold },
  when: { color: colors.textTertiary, fontSize: 14 },
  well: {
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
    backgroundColor: colors.surfaceGlass, paddingHorizontal: 14, paddingVertical: 10,
  },
  // Four lines of 22 before the field scrolls inside itself, three to
  // open on: room to see a remark whole, short of pushing the button
  // under a keyboard on the smallest phone.
  input: { color: colors.text, fontSize: 16, lineHeight: 22, minHeight: 66, maxHeight: 88, padding: 0, textAlignVertical: 'top' },
  count: { alignSelf: 'flex-end', color: colors.textTertiary, fontSize: 12, marginTop: 4 },
  seen: { gap: 8 },
  gloss: { color: colors.textTertiary, fontSize: 13, lineHeight: 18 },
});
