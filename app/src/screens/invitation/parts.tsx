// Out of `TripInvitationScreen` on 27 Nov 2026, so the screen's function
// fits the ceiling (`oversize.js`); the reasoning moved with the code,
// unchanged.

import React from 'react';
import { Text, View } from 'react-native';
import { Glyph, ICON } from '../../components/ui/glyph';
import { Avatar, Card, Empty, PressableScale, Screen } from '../../components/ui';
import type { useCrew } from '../../lib/crew';
import { clockOf, dateline, fmtMinutes, fmtVnd } from '../../lib/format';
import { fmtDistance } from '../../lib/geo';
import { useI18n } from '../../lib/i18n';
import { localized } from '../../lib/localized';
import type { useMyTrips } from '../../lib/mytrips';
import type { legsOf } from '../../lib/travel';
import { colors } from '../../theme';
import { s } from './styles';

type Trip = ReturnType<typeof useMyTrips>['data'][number];
type Stop = NonNullable<Trip['trip_stops']>[number];
type Person = ReturnType<typeof useCrew>['people'][string] | null;

/** The trip is not in hand: still loading, failed, or gone. */
export function NotHere({ failed, loaded, onBack }: { failed: boolean; loaded: boolean; onBack: () => void }) {
  const { t } = useI18n();
  return (
    <Screen compactTitle title={t('Invitation', 'Lời mời', '招待', '邀请', '邀請')} onBack={onBack} backBare>
      {/* `loaded` stays true after a failed fetch, so a failure has to
          be asked about first — or a dropped connection tells the
          invitee they were uninvited. */}
      <Empty text={failed
        ? t('Could not load this invitation. Go back and try again.',
          'Không tải được lời mời. Quay lại và thử lại.',
          '招待を読み込めませんでした。戻ってもう一度お試しください。',
          '无法加载这个邀请。请返回后重试。', '無法載入這個邀請。請返回後重試。')
        : loaded
          ? t('That invitation is no longer here.', 'Lời mời đó không còn nữa.', 'その招待はもうありません。', '这个邀请已不存在。', '這個邀請已不存在。')
          : t('Loading…', 'Đang tải…', '読み込み中…', '加载中…', '載入中…')}
      />
    </Screen>
  );
}

/** Who asks, and when. */
export function Asker({ from, trip, day, window }: { from: Person; trip: Trip; day: Date | null; window: string | null }) {
  const { t, lang } = useI18n();
  return (
    <Card style={s.asker}>
      <Avatar url={from?.avatar_url} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.askerName} numberOfLines={1}>
          {from?.full_name || (from?.handle ? `@${from.handle}` : t('Someone', 'Ai đó', '誰か', '某人', '某人'))}
          {' '}
          <Text style={s.askerVerb}>{t('wants you along', 'muốn rủ bạn đi', 'があなたを誘っています', '邀请你同行', '邀請你同行')}</Text>
        </Text>
        <Text style={s.askerMeta} numberOfLines={2}>
          {[from?.handle ? `@${from.handle}` : null, day ? dateline(lang, day) : trip.day, window]
            .filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Card>
  );
}

/** Their plan: each stop, the walk to the next, and the sum. */
export function Plan({ stops, legs, window, spend }: {
  stops: Stop[];
  legs: ReturnType<typeof legsOf>;
  window: string | null;
  spend: number;
}) {
  const { t, lang } = useI18n();
  return (
    <>
    <Text style={s.section}>{t('THEIR PLAN', 'KẾ HOẠCH CỦA HỌ', 'その予定', '对方的计划', '對方的計畫')}</Text>
    <Card style={s.plan}>
      {stops.map((st, i) => {
        const p = st.places;
        const leg = legs[i];
        return (
          <View key={p?.slug ?? i}>
            <View style={s.stop}>
              <Text style={s.at}>{st.arrive_min != null ? clockOf(st.arrive_min) : '—'}</Text>
              <View style={s.dot} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.name} numberOfLines={1}>
                  {p ? localized(p, 'name', lang)
                    : t('A place that has since gone', 'Một nơi giờ không còn', 'いまはない場所', '一个已不存在的地点', '一個已不存在的地點')}
                </Text>
                <Text style={s.where} numberOfLines={1}>
                  {[p ? localized(p, 'neighborhood', lang) : null,
                    st.dwell_min ? fmtMinutes(st.dwell_min, lang) : null]
                    .filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
            {/* The walk between, which is the half of a plan a list of
                times cannot show — two stops at 18:00 and 18:45 read
                very differently at 300m and at 4km. */}
            {leg && i < stops.length - 1 ? (
              <View style={s.leg}>
                <Glyph name="walk-outline" size={ICON.meta} color={colors.textTertiary} />
                <Text style={s.legText}>
                  {`${fmtDistance(leg.km)} · ≈ ${fmtMinutes(leg.minutes, lang)}`}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
      <View style={s.sum}>
        <Text style={s.sumText}>
          {[
            t(`${stops.length} stop${stops.length === 1 ? '' : 's'}`,
              `${stops.length} điểm dừng`, `${stops.length}か所`, `${stops.length} 个地点`, `${stops.length} 個地點`),
            window,
            spend > 0 ? t(`~${fmtVnd(spend)} / person`, `~${fmtVnd(spend)} / người`, `~${fmtVnd(spend)} / 人`, `~${fmtVnd(spend)} / 人`, `~${fmtVnd(spend)} / 人`) : null,
          ].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Card>
    </>
  );
}

/** How many are already coming. */
export function Going({ going, from }: { going: number; from: Person }) {
  const { t } = useI18n();
  return (
    <Card style={s.who}>
      <Glyph name="people-outline" size={ICON.action} color={colors.textSecondary} />
      <Text style={s.whoText}>
        {going === 1
          ? t(
            `${from?.full_name || 'They'} — you’d be 2 in all.`,
            `${from?.full_name || 'Họ'} — tính cả bạn là 2 người.`,
            `${from?.full_name || 'この人'} — あなたを入れて2人。`,
            `${from?.full_name || '对方'} — 加上你一共 2 人。`, `${from?.full_name || '對方'} — 加上你一共 2 人。`,
          )
          : t(
            `${from?.full_name || 'They'} and ${going - 1} other${going - 1 === 1 ? '' : 's'} — you’d be ${going + 1} in all.`,
            `${from?.full_name || 'Họ'} và ${going - 1} người nữa — tính cả bạn là ${going + 1}.`,
            `${from?.full_name || 'この人'} と他${going - 1}人 — あなたを入れて${going + 1}人。`,
            `${from?.full_name || '对方'}和另外 ${going - 1} 人 — 加上你一共 ${going + 1} 人。`, `${from?.full_name || '對方'}和另外 ${going - 1} 人 — 加上你一共 ${going + 1} 人。`,
          )}
      </Text>
    </Card>
  );
}

/** Who keeps the plan, and what accepting brings. */
export function Keeps({ from }: { from: Person }) {
  const { t } = useI18n();
  return (
    <Card style={s.who}>
      <Glyph name="lock-closed-outline" size={ICON.action} color={colors.textTertiary} />
      <Text style={s.noteText}>
        {t(
          `${from?.full_name ? `${from.full_name} keeps` : 'They keep'} the plan. Accepting puts it in your Trips and you get a reminder the evening before and on the day.`,
          `${from?.full_name || 'Họ'} giữ kế hoạch. Đồng ý thì chuyến vào mục Chuyến đi của bạn, và bạn được nhắc vào tối hôm trước và trong ngày đi.`,
          `予定は${from?.full_name || 'この人'}のものです。承諾すると旅程に入り、前の晩と当日にリマインダーが届きます。`,
          `计划由${from?.full_name || '对方'}管理。接受后，它会出现在你的行程中，你会在前一晚和当天收到提醒。`, `計畫由${from?.full_name || '對方'}管理。接受後，它會出現在你的行程中，你會在前一晚和當天收到提醒。`,
        )}
      </Text>
    </Card>
  );
}

/** The two answers — or the one already given. */
export function Answers({ answered, accepted, busy, onAnswer }: {
  answered: boolean;
  accepted: boolean;
  busy: boolean;
  onAnswer: (said: 'accepted' | 'declined') => void;
}) {
  const { t } = useI18n();
  return answered ? (
      <Text style={s.already}>
        {accepted
          ? t('You said you’re in.', 'Bạn đã nhận lời.', '参加すると回答済みです。', '你已回复参加。', '你已回覆參加。')
          : t('You said you can’t make it.', 'Bạn đã từ chối.', '不参加と回答済みです。', '你已回复无法参加。', '你已回覆無法參加。')}
      </Text>
    ) : (
      <>
        <View style={s.answers}>
          <PressableScale
            onPress={() => onAnswer('accepted')}
            accessibilityRole="button"
            style={{ flex: 1 }}
            contentStyle={[s.yes, busy && s.busy]}
          >
            <Glyph name="checkmark" size={ICON.action} color={colors.accentInk} />
            <Text style={s.yesText}>{t('I’m in', 'Tôi tham gia', '参加する', '我参加', '我參加')}</Text>
          </PressableScale>
          <PressableScale
            onPress={() => onAnswer('declined')}
            accessibilityRole="button"
            style={{ flex: 1 }}
            contentStyle={[s.no, busy && s.busy]}
          >
            <Text style={s.noText}>{t('Can’t make it', 'Không đi được', '行けません', '无法参加', '無法參加')}</Text>
          </PressableScale>
        </View>
        <Text style={s.foot}>
          {t(
            'Either answer tells them. Declining does not delete their plan.',
            'Dù trả lời thế nào họ cũng biết. Từ chối không xoá kế hoạch của họ.',
            'どちらの回答も相手に伝わります。断っても相手の予定は消えません。',
            '无论哪种回复，对方都会知道。拒绝不会删除对方的计划。', '無論哪種回覆，對方都會知道。拒絕不會刪除對方的計畫。',
          )}
        </Text>
      </>
    );
}
