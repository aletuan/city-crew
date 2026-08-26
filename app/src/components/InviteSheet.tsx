// "Who's coming?" — the crew, with the ones you have already asked ticked.
//
// It closes on Send rather than staying open the way SaveSheet does, and
// that is the difference between the two: saving to a second list is
// another private tick, but sending is one statement that reaches other
// people. A sheet that stayed open after it would leave the reader looking
// at a list they have finished with, wondering whether the press landed.
//
// ── only friends, and why the sheet does not say so ──
//
// The insert policy refuses anybody who is not an accepted friend, so
// listing anybody else would be offering a button that cannot work. There
// is no "add someone" affordance here for the same reason — the answer to
// "they aren't in the list" is the Crew screen, not this one, and a link
// out of a sheet mid-send is a way to lose the selection.
//
// ── an already-invited name is ticked, not hidden ──
//
// This is the one place that answers "who did I ask?", and a name quietly
// missing from it reads as having forgotten to ask them. An ANSWERED
// invitation is ticked and locked: withdrawing only reaches unanswered
// rows (see the delete policy), and a checkbox that springs back is worse
// than one that does not move.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FriendProfile } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { candidates, diffSelection, roomLeft, type InviteRow } from '../lib/invites';
import { colors, display, font, space } from '../theme';
import { Avatar, GradientCta, PressableScale } from './ui';

export default function InviteSheet({
  open, company, friendIds, people, mutual, invites, sending, onClose, onSend,
}: {
  open: boolean;
  /** Wording only — a couple's evening and four friends' evening ask the
   *  same question with a different sentence under it. */
  company: string | null;
  /** Accepted friends, in the order the crew list holds them. */
  friendIds: readonly string[];
  people: Record<string, FriendProfile>;
  /** Shared-taste counts, the number each row wears. */
  mutual: Record<string, number>;
  /** Every invitation already on this trip. */
  invites: readonly InviteRow[];
  sending: boolean;
  onClose: () => void;
  onSend: (invite: string[], withdraw: string[]) => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const rise = useRef(new Animated.Value(1)).current;

  const rows = useMemo(() => candidates(friendIds, invites), [friendIds, invites]);

  // Seeded from what is already sent, so the sheet opens showing the truth
  // rather than an empty slate the reader would have to rebuild.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) setPicked(new Set(rows.filter((r) => r.invited).map((r) => r.id)));
  }, [open, rows]);

  useEffect(() => {
    if (!open) { rise.setValue(1); return; }
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [open, rise]);

  const { invite, withdraw } = diffSelection(rows, picked);
  const left = roomLeft(invites);
  // What the button says it will do. Sending leads, because it is the half
  // that reaches other people; a withdrawal on its own gets its own word
  // rather than being called "send 0". A press that does both is labelled
  // by the sending alone — "Send 1 and take back 1" is a button nobody
  // reads, and the ticks above already show the second half.
  const moved = invite.length + withdraw.length;

  const toggle = (id: string, locked: boolean) => {
    if (locked) return;
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const label = sending
    ? t('Sending…', 'Đang gửi…', '送信中…')
    : invite.length
      ? t(
        `Send ${invite.length} invite${invite.length === 1 ? '' : 's'}`,
        `Gửi ${invite.length} lời mời`,
        `${invite.length}件の招待を送る`,
      )
      : withdraw.length
        ? t(
          `Take back ${withdraw.length}`,
          `Rút lại ${withdraw.length}`,
          `${withdraw.length}件を取り消す`,
        )
        : t('Send invites', 'Gửi lời mời', '招待を送る');

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t('Close', 'Đóng', '閉じる')} />
      <Animated.View
        style={[
          s.sheet,
          {
            paddingBottom: insets.bottom + 16,
            transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 360] }) }],
          },
        ]}
      >
        <View style={s.grabber} />
        <Text style={s.title}>{t('Who’s coming?', 'Ai sẽ đi cùng?', '誰と行く？')}</Text>
        <Text style={s.subtitle}>
          {company === 'couple'
            ? t('A couple’s evening — pick who joins.', 'Buổi tối hai người — chọn người đi cùng.', 'ふたりの夜 — 誰を誘う？')
            : company === 'family'
              ? t('A family day — pick who joins.', 'Ngày của gia đình — chọn người đi cùng.', '家族の日 — 誰を誘う？')
              : t('A friends day — pick who joins.', 'Ngày với bạn bè — chọn người đi cùng.', '友だちとの日 — 誰を誘う？')}
        </Text>

        {friendIds.length === 0 ? (
          // Not an error, and not a dead end phrased as one: the reader has
          // simply not added anybody yet, and the Crew screen is where that
          // happens.
          <Text style={s.none}>
            {t(
              'Nobody in your crew yet. Add a friend first, then you can invite them.',
              'Chưa có ai trong nhóm. Thêm bạn trước rồi mới mời được.',
              'まだ仲間がいません。先に友だちを追加してください。',
            )}
          </Text>
        ) : (
          <ScrollView style={s.list} contentContainerStyle={{ paddingVertical: 4 }} showsVerticalScrollIndicator={false}>
            {rows.map((r) => {
              const p = people[r.id];
              const on = picked.has(r.id);
              const n = mutual[r.id] ?? 0;
              return (
                <PressableScale
                  key={r.id}
                  onPress={() => toggle(r.id, r.locked)}
                  haptic={r.locked ? 'none' : 'selection'}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: r.locked }}
                  containerStyle={{ alignSelf: 'stretch' }}
                  style={[s.row, r.locked && s.rowLocked]}
                >
                  <Avatar url={p?.avatar_url} size={44} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.name} numberOfLines={1}>
                      {p?.full_name || p?.handle || t('Someone', 'Ai đó', '誰か')}
                    </Text>
                    <Text style={s.meta} numberOfLines={1}>
                      {p?.handle ? `@${p.handle}` : ''}
                      {n > 0 ? ` · ${t(
                        `${n} mutual save${n === 1 ? '' : 's'}`,
                        `${n} nơi cùng lưu`,
                        `共通の保存 ${n}`,
                      )}` : ''}
                    </Text>
                  </View>
                  {/* A locked row wears the answer instead of a checkbox —
                      a tick that cannot be untapped should not look like
                      one that can. */}
                  {r.locked ? (
                    <Text style={s.locked}>
                      {t('Answered', 'Đã trả lời', '回答済み')}
                    </Text>
                  ) : (
                    <View style={[s.tick, on && s.tickOn]}>
                      {on ? <Ionicons name="checkmark" size={15} color={colors.accentInk} /> : null}
                    </View>
                  )}
                </PressableScale>
              );
            })}
          </ScrollView>
        )}

        <View style={s.note}>
          <Ionicons name="time-outline" size={15} color={colors.textTertiary} />
          <Text style={s.noteText}>
            {left === 0
              ? t(
                'This trip is full — twenty is the most one evening can hold.',
                'Chuyến này đã đầy — một buổi tối tối đa hai mươi người.',
                'この旅程は満員です — 一晩は最大20人までです。',
              )
              : t(
                'They see the plan once they accept. Times and stops stay yours to edit.',
                'Họ thấy kế hoạch sau khi đồng ý. Giờ giấc và các điểm dừng vẫn do bạn sửa.',
                '承諾すると予定が見えます。時刻とスポットはあなたが編集します。',
              )}
          </Text>
        </View>

        <GradientCta
          icon="paper-plane-outline"
          wide
          label={label}
          onPress={() => { if (!sending && moved) onSend(invite, withdraw); }}
        />

        <PressableScale onPress={onClose} accessibilityRole="button" style={s.later}>
          <Text style={s.laterText}>{t('Not now', 'Để sau', 'あとで')}</Text>
        </PressableScale>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: space.page, paddingTop: 10,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  grabber: {
    width: 38, height: 4, borderRadius: 2, alignSelf: 'center',
    backgroundColor: colors.textTertiary, marginBottom: 14,
  },
  title: { color: colors.text, fontSize: 22, fontFamily: display.bold },
  subtitle: { color: colors.textTertiary, fontSize: 14, marginTop: 3, marginBottom: 10 },
  none: { color: colors.textTertiary, fontSize: 14.5, lineHeight: 21, paddingVertical: 18 },

  list: { maxHeight: 300 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowLocked: { opacity: 0.62 },
  name: { color: colors.text, fontSize: 16, fontWeight: font.medium },
  meta: { color: colors.textTertiary, fontSize: 13, marginTop: 1 },
  tick: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.borderGlass,
  },
  tickOn: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  locked: { color: colors.textTertiary, fontSize: 12.5, fontWeight: font.medium },

  note: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start',
    backgroundColor: colors.surfaceGlass,
    borderRadius: 14, padding: 13, marginTop: 10, marginBottom: 12,
  },
  noteText: { flex: 1, color: colors.textTertiary, fontSize: 13, lineHeight: 19 },

  later: { paddingVertical: 14, marginTop: 2, alignSelf: 'center' },
  laterText: { color: colors.textSecondary, fontSize: 15.5, fontWeight: font.medium },
});
