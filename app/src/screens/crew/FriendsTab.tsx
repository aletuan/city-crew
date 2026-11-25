// The Friends tab: your crew, and the people you have blocked.
//
// Out of `CrewScreen` on 25 Nov 2026, as the screens of the 22 Nov code
// review were (F1, F5): the reasoning moved with the code, unchanged.

import React, { type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Card, CHIP_SLOP, EmptyState, PressableScale } from '../../components/ui';
import type { FriendProfile } from '../../lib/data';
import type { useCrew } from '../../lib/crew';
import { atHandle } from '../../lib/handle';
import type { useI18n } from '../../lib/i18n';
import { colors } from '../../theme';
import type { Nav } from '../../nav';
import { Face, Options, s, Who } from './parts';
import type { CrewSheets } from './useCrewSheets';

type Crew = ReturnType<typeof useCrew>;

export function FriendsTab({
  t, navigation, friends, people, mutual, blocks, pending, sheets, asking, failedState, addCta,
}: {
  t: ReturnType<typeof useI18n>['t'];
  navigation: Nav;
  friends: string[];
  people: Record<string, FriendProfile>;
  mutual: Crew['mutual'];
  blocks: Crew['blocks'];
  /** The people a write is still out for, whose buttons wait. */
  pending: ReadonlySet<string>;
  sheets: CrewSheets;
  asking: boolean;
  failedState: ReactNode | null;
  addCta: ReactNode;
}) {
  const { openFriendSheet, known, savesLine, confirmUnblock } = sheets;
  return (
    <>
      {friends.length > 0 ? (
        <Card>
          {friends.map((id, i) => {
            const p = people[id];
            return (
              <PressableScale
                key={id}
                contentStyle={[s.row, i > 0 && s.rowDivider]}
                // A press opens their page (16 Nov 2026); until then
                // the row answered only a long press. Nothing to
                // open for a profile that has not arrived.
                onPress={p ? () => navigation.navigate('Person', { handle: p.handle }) : undefined}
                onLongPress={() => openFriendSheet(known(id), mutual[id])}
                accessibilityLabel={p ? atHandle(p.handle) : id}
                testID={`crew-friend-${i}`}
              >
                <Face p={p} />
                <Who p={p} extra={savesLine(mutual[id])} />
                {/* The visible door to Unfriend and Block. The
                    long-press stays, but a gesture with no mark on
                    the screen is a feature only its author knows
                    about. */}
                <Options onPress={() => openFriendSheet(known(id), mutual[id])} />
              </PressableScale>
            );
          })}
        </Card>
      ) : asking ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 28 }} />
      ) : failedState ? failedState : (
        <EmptyState
          icon="people"
          title={t('No friends yet', 'Chưa có bạn bè nào', 'まだ友達がいません', '还没有好友', '還沒有好友')}
          body={t(
            'Ask a friend for their username and add them here — then you can invite each other on trips.',
            'Hỏi username của bạn bè rồi thêm ở đây — để rủ nhau vào chung chuyến đi.',
            '友達にユーザー名を聞いてここで追加しましょう — 旅程に誘い合えるようになります。',
            '问到朋友的用户名后在这里添加 — 就可以互相邀请加入行程。', '問到朋友的使用者名稱後在這裡新增 — 就可以互相邀請加入行程。',
          )}
          testID="crew-friends-empty"
        >
          {addCta}
        </EmptyState>
      )}

      {/* The boundary, visible and reversible — a block managed
          from the same screen it was made on, per the store
          guideline that asks for the control and the plain decency
          that asks for the undo. */}
      {blocks.data.length > 0 && (
        <>
          <Text style={s.head}>{t('Blocked', 'Đã chặn', 'ブロック中', '已屏蔽', '已遮蔽')}</Text>
          <Card>
            {blocks.data.map((id, i) => {
              const p = people[id];
              return (
                <View key={id} style={[s.row, i > 0 && s.rowDivider]}>
                  <Face p={p} />
                  <Who p={p} />
                  <PressableScale
                    contentStyle={s.quietBtn}
                    hitSlop={CHIP_SLOP}
                    style={pending.has(id) ? s.working : undefined}
                    onPress={() => confirmUnblock(known(id))}
                    disabled={pending.has(id)}
                    aria-disabled={pending.has(id)}
                    accessibilityRole="button"
                  >
                    <Text style={s.quietText}>{t('Unblock', 'Bỏ chặn', '解除', '取消屏蔽', '取消遮蔽')}</Text>
                  </PressableScale>
                </View>
              );
            })}
          </Card>
        </>
      )}
      {/* A list that could not be read is not an empty one. Without
          this the section simply did not draw offline, which is
          what "you have blocked nobody" looks like. Only while there
          is nothing to show: a refresh that fails over a list
          already here leaves the list, which is not wrong enough to
          interrupt. */}
      {blocks.error && blocks.data.length === 0 && (
        <>
          <Text style={s.head}>{t('Blocked', 'Đã chặn', 'ブロック中', '已屏蔽', '已遮蔽')}</Text>
          <Card>
            <View style={s.row} testID="crew-blocks-failed">
              <Text style={[s.meta, { flex: 1 }]}>
                {t("Couldn't load who you have blocked.", 'Không tải được danh sách đã chặn.', 'ブロック中のユーザーを読み込めませんでした。', '无法加载已屏蔽的用户。', '無法載入已遮蔽的使用者。')}
              </Text>
              <PressableScale
                contentStyle={s.quietBtn}
                hitSlop={CHIP_SLOP}
                onPress={() => blocks.reload()}
                accessibilityRole="button"
                testID="crew-blocks-retry"
              >
                <Text style={s.quietText}>{t('Try again', 'Thử lại', '再試行', '重试', '重試')}</Text>
              </PressableScale>
            </View>
          </Card>
        </>
      )}
    </>
  );
}
