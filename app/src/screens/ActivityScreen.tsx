// Activity — what other people did with your collections while you were
// away: applause, and copies saved of them, in one timeline. A row opens
// the collection that earned it and wears the chevron that says so; one
// on a collection that is gone opens nothing and wears none.
//
// News only. Friend requests lived here too, as a REQUESTS section above
// the timeline with the same Accept and Decline as the Requests tab on
// Your crew — the same list in two places, and on Profile the same
// request counted twice, as the dot on Connect with friends and inside
// Activity's number. The owner took them out on 20 Oct 2026; Crew has
// been the inbox since #309, and nothing but Profile opens this screen.
//
// Your own plans are not here. An UPCOMING section carried the nearest
// trip for a day (6–7 Oct 2026) and went: by then the same fact was on
// the Trips tab's dot, in the morning notification and on the Trips
// screen, and this copy — the deepest, one line, and showing one trip
// when there were two on the day — was the only one telling it wrong.
//
// The applause comes through `likes_on_mine`, which names every liker
// to the one person allowed to ask — the owner of the list. "Someone
// liked…" survives only as the fallback for a liker whose profile is
// gone. See the named_applause migration for why the owner is not
// "the public" that the likes table's privacy promise protects against.

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthHeader, AuthScreen } from '../components/authUi';
import { Avatar, Card, Empty, PressableScale } from '../components/ui';
import { useSession } from '../lib/auth';
import { APPLAUSE_DAYS } from '../lib/activityWindow';
import { numericDate } from '../lib/format';
import { useCollections } from '../lib/catalog';
import { fetchApplause, fetchCopies, useCuratorAvatarsQuery, useMyCollections } from '../lib/data';
import { type ActivityItem, agoOf, type Applause, buildActivity, type Copy } from '../lib/friends';
import { atHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { colors, space, type } from '../theme';
import type { Nav } from '../nav';

/** How far back the applause reaches. Two weeks: long enough that a
 *  weekly reader misses nothing, short enough that the screen is news
 *  rather than an archive. */


export default function ActivityScreen({ navigation }: { navigation: Nav }) {
  const { t, lang } = useI18n();
  const { session } = useSession();
  const me = session?.user?.id ?? null;
  const mine = useMyCollections(me);
  const cols = useCollections();

  const [applause, setApplause] = useState<Applause[] | null>(null);
  const [copies, setCopies] = useState<Copy[] | null>(null);
  useEffect(() => {
    if (!me) { setApplause([]); setCopies([]); return; }
    const since = new Date(Date.now() - APPLAUSE_DAYS * 86400000).toISOString();
    // Quiet on failure, each half on its own: the feed shows what it
    // could get, and a dropped likes call does not take the copies with it.
    fetchApplause(since).then(setApplause).catch(() => setApplause([]));
    // The same window: a copy is news for as long as a like is.
    fetchCopies(since).then(setCopies).catch(() => setCopies([]));
  }, [me]);

  const earlier = useMemo<ActivityItem[]>(() => buildActivity(applause ?? [], copies ?? []), [applause, copies]);

  // The faces, by handle: the same lookup the bylines use, because a
  // liker need not be a curator and need not be a friend, so neither the
  // catalog's faces nor the crew's cover everyone here. One batched ask
  // for every actor on the screen; a handle with no face gets the blank
  // disc, as does a like whose liker is unnamed.
  const actors = useMemo(
    () => earlier.map((it) => (it.kind === 'applause' ? it.liker_handle : it.copier_handle) ?? '').filter(Boolean),
    [earlier],
  );
  const faces = useCuratorAvatarsQuery(actors);

  // A collection id is what the applause carries; the title and the slug
  // are what the row needs. Both shelves are searched — the liked list is
  // yours, but "yours" spans the desk shelf and your own. One lookup for
  // both, so a row with a title always has somewhere to go.
  const collectionOf = (collectionId: string) =>
    [...mine.data, ...cols.data].find((c) => c.id === collectionId) ?? null;

  const agoLabel = (iso: string): string => {
    const ago = agoOf(iso, Date.now());
    if (ago.unit === 'now') return t('just now', 'vừa xong', 'たった今', '刚刚', '剛剛');
    if (ago.unit === 'minutes') return t(`${ago.n}m ago`, `${ago.n} phút trước`, `${ago.n}分前`, `${ago.n} 分钟前`, `${ago.n} 分鐘前`);
    if (ago.unit === 'hours') return t(`${ago.n}h ago`, `${ago.n} giờ trước`, `${ago.n}時間前`, `${ago.n} 小时前`, `${ago.n} 小時前`);
    if (ago.n === 1) return t('yesterday', 'hôm qua', '昨日', '昨天', '昨天');
    // A week of "n days ago", then the date: past a week nobody counts
    // back, they look at a calendar — Mail and Instagram turn the same
    // corner. The date is `numericDate`, the check-in rows' form, so a
    // day already past is written one way across the profile stack.
    if (ago.n > RELATIVE_DAYS) return numericDate(lang, new Date(iso));
    return t(`${ago.n} days ago`, `${ago.n} ngày trước`, `${ago.n}日前`, `${ago.n} 天前`, `${ago.n} 天前`);
  };

  // Only the two fetches the timeline is built from.
  const loading = applause === null || copies === null;

  return (
    <AuthScreen>
      <AuthHeader onBack={() => navigation.goBack()} title={t('Activity', 'Hoạt động', 'アクティビティ', '动态', '動態')} />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
      ) : earlier.length === 0 ? (
        <Empty text={t(
          'Quiet so far. When someone likes or copies one of your collections, you will see it here.',
          'Chưa có gì. Khi có người thích hay sao chép bộ sưu tập của bạn, bạn sẽ thấy ở đây.',
          'まだ静かです。あなたのコレクションにいいねやコピーがあると、ここに表示されます。',
          '暂时还很安静。有人点赞或复制你的合集时，会显示在这里。', '暫時還很安靜。有人按讚或複製你的合集時，會顯示在這裡。',
        )} />
      ) : (
            <Card testID="earlier-card">
              {earlier.map((item, i) => {
                const col = collectionOf(item.collection_id);
                const title = col ? t(col.title_en, col.title_vi, col.title_ja) : null;
                // The handle, not the full name: it is how the rest of the
                // app names a person in public ("by @trang"), and it is the
                // name they chose to be known by. The full name is for the
                // request card on Your crew, where recognising a human is
                // the decision being made.
                const who = (item.kind === 'applause' ? item.liker_handle : item.copier_handle);
                const by = who ? atHandle(who) : null;
                const shown = title ?? '…';
                // Two kinds, one sentence shape. The copy's verb is the
                // button's own words — "Save a copy" is what they pressed.
                const line = item.kind === 'applause'
                  ? (by
                    ? t(`${by} liked “${shown}”`, `${by} đã thích “${shown}”`, `${by} が「${shown}」にいいねしました`, `${by} 点赞了“${shown}”`, `${by} 按讚了「${shown}」`)
                    : t(`Someone liked “${shown}”`, `Ai đó đã thích “${shown}”`, `誰かが「${shown}」にいいねしました`, `有人点赞了“${shown}”`, `有人按讚了「${shown}」`))
                  : (by
                    ? t(`${by} saved a copy of “${shown}”`, `${by} đã lưu bản sao “${shown}”`, `${by} が「${shown}」のコピーを保存しました`, `${by} 保存了“${shown}”的副本`, `${by} 儲存了「${shown}」的副本`)
                    : t(`Someone saved a copy of “${shown}”`, `Ai đó đã lưu bản sao “${shown}”`, `誰かが「${shown}」のコピーを保存しました`, `有人保存了“${shown}”的副本`, `有人儲存了「${shown}」的副本`));
                return (
                  <PressableScale
                    key={`${item.kind}-${item.collection_id}-${item.at}`}
                    contentStyle={[s.row, i > 0 && s.rowDivider]}
                    onPress={col ? () => navigation.navigate('CollectionDetail', { slug: col.slug }) : undefined}
                    // A button only when it goes somewhere — VoiceOver has to
                    // hear that this row opens the list.
                    accessibilityRole={col ? 'button' : undefined}
                  >
                    {/* Who, then what: the actor's face leads the row, as
                        every social feed has it (Instagram, Threads), and
                        the kind of thing they did rides on its corner as a
                        badge — the heart or the copy, filled and in the
                        accent, small enough to be a mark and not a second
                        picture. It replaced a bare glyph per row, which
                        told the eye nothing once five rows shared it. */}
                    <View style={s.face} testID="row-face">
                      <Avatar url={who ? faces.data[who] : null} size={FACE} />
                      <View style={s.kind} testID="kind-badge">
                        <Ionicons name={item.kind === 'applause' ? 'heart' : 'copy'} size={11} color={colors.accent} />
                      </View>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.line} numberOfLines={2}>
                        {line}
                      </Text>
                      <Text style={s.meta}>{agoLabel(item.at)}</Text>
                    </View>
                    {/* Only where there is somewhere to go: the same
                        condition as the role above, so what VoiceOver
                        hears and what the eye sees agree. */}
                    {col ? <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} style={s.rowEnd} /> : null}
                  </PressableScale>
                );
              })}
            </Card>
      )}
    </AuthScreen>
  );
}

/** The feed line's line height, and the box that holds a 19pt glyph's
 *  whole line — see `mark`. */
const LINE = 21;
/** How many days a time is told as a distance before it is told as a date. */
const RELATIVE_DAYS = 7;
/** The face's side: the 44pt the slot it replaced had, so the text
 *  column stays where it was. */
const FACE = 44;

const s = StyleSheet.create({
  // Centred: a 44pt face beside one or two lines of text wants its
  // middle on theirs. The rows were top-aligned while the mark was a
  // 19pt glyph set on the first line; a face has no first line to sit on.
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: space.cardPadding, paddingVertical: 12,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  meta: { color: colors.textTertiary, ...type.meta },
  // The row aligns its top so the mark can sit on the first line of text;
  // the chevron keeps the middle, as Profile's rows do it.
  rowEnd: { alignSelf: 'center' },
  face: { width: FACE, height: FACE },
  // The badge: a 20pt disc on the card's own ground with the row's
  // hairline around it, hung a hair past the face's corner so it reads
  // as pinned on rather than printed on. 11pt glyph: the heart is a
  // mark here, not an icon to tap.
  kind: {
    position: 'absolute', right: -3, bottom: -3,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.surfaceCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  line: { color: colors.text, fontSize: 15, lineHeight: LINE },
});
