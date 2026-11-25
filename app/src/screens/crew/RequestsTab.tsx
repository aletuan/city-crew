// The Requests tab: the add field, requests waiting on you, the ones you
// sent, and the introductions.
//
// Out of `CrewScreen` on 25 Nov 2026, as the screens of the 22 Nov code
// review were (F1, F5): the reasoning moved with the code, unchanged.

import React, { type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Glyph, ICON } from '../../components/ui/glyph';
import { FieldRow, PrimaryButton } from '../../components/authUi';
import { Card, CHIP_SLOP, EmptyState, PressableScale } from '../../components/ui';
import type { FriendProfile, ListTitle } from '../../lib/data';
import { reasonLine, type Suggestion, type splitFriendships } from '../../lib/friends';
import { atHandle } from '../../lib/handle';
import type { useI18n } from '../../lib/i18n';
import { colors, font, gradAI } from '../../theme';
import type { Nav } from '../../nav';
import { Face, nameOf, Options, PersonDoor, s, Who } from './parts';
import type { CrewActions } from './useCrewActions';
import type { CrewSheets } from './useCrewSheets';

type Props = {
  t: ReturnType<typeof useI18n>['t'];
  navigation: Nav;
  crew: ReturnType<typeof splitFriendships>;
  people: Record<string, FriendProfile>;
  actions: CrewActions;
  sheets: CrewSheets;
  intros: Suggestion[];
  titles: Record<string, ListTitle>;
  /** The edges never answered yet: a spinner in place of the empty state. */
  asking: boolean;
  /** Drawn instead of the empty state when the edges could not be read. */
  failedState: ReactNode | null;
  addCta: ReactNode;
};

export function RequestsTab(props: Props) {
  return (
    <>
      <AddField {...props} />
      <Incoming {...props} />
      <Outgoing {...props} />
      <Intros {...props} />
      <Nothing {...props} />
    </>
  );
}

/** The field ⊕ opens: a username, the people it matches, Send. */
function AddField(props: Props) {
  const { actions: { adding, handle, setHandle, busy, note, setNote, found, setFound, send }, t } = props;
  return (
    <>
      {adding && (
        <Card style={s.addCard}>
          <FieldRow
            icon="at-outline"
            label={t('Their username', 'Username của bạn ấy', '相手のユーザー名', '对方的用户名', '對方的使用者名稱')}
            testID="crew-handle"
            value={handle}
            onChangeText={setHandle}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="send"
            onSubmitEditing={send}
            error={note}
          />
          {found.length > 0 && (
            <View>
              {found.map((f, i) => (
                <PressableScale
                  key={f.id}
                  contentStyle={[s.typeRow, i > 0 && s.rowDivider]}
                  scaleTo={0.97}
                  onPress={() => { setHandle(f.handle); setFound([]); setNote(null); }}
                  accessibilityRole="button"
                  accessibilityLabel={atHandle(f.handle)}
                >
                  <Face p={f} size={30} />
                  <Text style={s.typeName} numberOfLines={1}>{nameOf(f)}</Text>
                  <Text style={s.typeHandle} numberOfLines={1}>{atHandle(f.handle)}</Text>
                </PressableScale>
              ))}
            </View>
          )}
          <PrimaryButton label={t('Send request', 'Gửi lời mời', 'リクエスト送信', '发送请求', '傳送請求')} onPress={send} busy={busy} testID="crew-send" />
        </Card>
      )}
    </>
  );
}

/** Requests waiting on you, with Accept and Decline on each. */
function Incoming(props: Props) {
  const { actions: { pending, answer }, sheets: { openRequestSheet }, crew, people, navigation, t } = props;
  return (
    <>
      {/* Answered here as well as in Activity, and that is not a
          duplicate: Activity is what happened while you were away,
          this is the desk where the crew is managed. Both reach
          the same two verbs.

          Each heading carries its own figure, as Trips' "Upcoming ·
          1" did before its halves became tabs (owner, 20 Nov 2026).
          The Requests tab's pill counts these alone — the ones waiting on you — and "Pending
          · 1" under it is the same number, so the pill says what it
          counts without a word of explanation, while "Sent · 2" says
          what you are waiting on. Suggestions get none: they are not
          requests. Weighed and not taken: counting Sent into the
          pill, which would leave it lit for days with nothing for
          the reader to do, and at odds with the tab bar's dot. */}
      {crew.incoming.length > 0 && (
        <>
          <Text style={s.head}>{t('Pending', 'Đang chờ', '保留中', '待处理', '待處理')} · {crew.incoming.length}</Text>
          {crew.incoming.map((r, i) => {
            const p = people[r.requester];
            return (
              <Card key={r.requester} style={s.reqCard}>
                <View style={s.reqTop}>
                  <PersonDoor p={p} navigation={navigation} size={46} gap={12} testID={`crew-request-who-${i}`}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.reqTitle}>
                        <Text style={{ fontWeight: font.bold }}>{nameOf(p)}</Text>
                        {' '}
                        {t('wants to join your crew', 'muốn kết bạn với bạn', 'がクルーに参加したがっています', '想加你为好友', '想加你為好友')}
                      </Text>
                      {p ? <Text style={s.meta}>{atHandle(p.handle)}</Text> : null}
                    </View>
                  </PersonDoor>
                  <Options onPress={() => openRequestSheet(r.requester, p)} />
                </View>
                <View style={s.answers}>
                  <PressableScale
                    style={[s.half, pending.has(r.requester) && s.working]}
                    onPress={() => answer(r.requester, true)}
                    disabled={pending.has(r.requester)}
                    aria-disabled={pending.has(r.requester)}
                    accessibilityRole="button"
                    testID={`crew-accept-${i}`}
                  >
                    <LinearGradient {...gradAI} style={s.accept}>
                      <Glyph name="checkmark" size={ICON.action} color={colors.accentInk} />
                      <Text style={s.acceptText}>{t('Accept', 'Đồng ý', '承認', '接受', '接受')}</Text>
                    </LinearGradient>
                  </PressableScale>
                  <PressableScale
                    style={[s.half, pending.has(r.requester) && s.working]}
                    contentStyle={s.decline}
                    onPress={() => answer(r.requester, false)}
                    disabled={pending.has(r.requester)}
                    aria-disabled={pending.has(r.requester)}
                    onLongPress={() => openRequestSheet(r.requester, p)}
                    accessibilityRole="button"
                  >
                    <Text style={s.declineText}>{t('Decline', 'Từ chối', '拒否', '拒绝', '拒絕')}</Text>
                  </PressableScale>
                </View>
              </Card>
            );
          })}
    </>
  )}
    </>
  );
}

/** Requests you sent, still unanswered. */
function Outgoing(props: Props) {
  const { sheets: { openSentSheet, known }, crew, people, navigation, t } = props;
  return (
    <>
      {/* What you asked and are still waiting on. Without this the
          send looked like it vanished — the request lived only on
          the other person's screen. */}
      {crew.outgoing.length > 0 && (
        <>
          <Text style={s.head}>{t('Sent', 'Đã gửi', '送信済み', '已发送', '已傳送')} · {crew.outgoing.length}</Text>
          <Card>
            {crew.outgoing.map((r, i) => {
              const p = people[r.addressee];
              return (
                <View key={r.addressee} style={[s.row, i > 0 && s.rowDivider]} testID={`crew-sent-${i}`}>
                  {/* Who, and nothing after it. "waiting on their
                      answer" sat on every row, saying again what the
                      "Sent" heading above already says (owner, 26
                      Oct 2026). The sheet behind Cancel keeps it:
                      there is no heading there to say it. */}
                  <PersonDoor p={p} navigation={navigation} gap={14} testID={`crew-sent-who-${i}`}>
                    <Who p={p} />
                  </PersonDoor>
                  <PressableScale contentStyle={s.quietBtn} hitSlop={CHIP_SLOP} onPress={() => openSentSheet(known(r.addressee))} accessibilityRole="button">
                    <Text style={s.quietText}>{t('Cancel', 'Huỷ', '取り消す', '取消', '取消')}</Text>
                  </PressableScale>
                </View>
              );
            })}
          </Card>
    </>
  )}
    </>
  );
}

/** The introductions, each with its reason. */
function Intros(props: Props) {
  const { actions: { pending, askSuggested, dismiss }, intros, titles, people, navigation, t } = props;
  return (
    <>
      {/* The introductions. Each row carries its own reason — a
          suggested stranger with no stated basis reads as the app
          guessing, and this one is not guessing. Two lines: who,
          and why. The handle was a third until the owner saw it on
          a phone (25 Oct 2026) and took it out; a person with no
          name still shows as their handle, through `nameOf`. */}
      {intros.length > 0 && (
        <>
          <Text style={s.head}>
            {t('Suggested for you', 'Gợi ý cho bạn', 'あなたへのおすすめ', '为你推荐', '為你推薦')}
          </Text>
          <Card>
            {intros.map((sg, i) => {
              const p = people[sg.other];
              const list = sg.collectionId ? titles[sg.collectionId] : undefined;
              const why = reasonLine(sg, list ? t(list.title_en, list.title_vi, list.title_ja ?? undefined) : null, t);
              return (
                <View key={sg.other} style={[s.row, i > 0 && s.rowDivider]}>
                  <PersonDoor p={p} navigation={navigation} gap={14} testID={`crew-suggestion-who-${sg.other}`}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.name} numberOfLines={1}>{nameOf(p)}</Text>
                      {/* Two lines: the longest public title on 25 Oct
                          2026 was 27 characters, and with the sentence
                          around it that is about 45 — past what one
                          line holds beside the two buttons. */}
                      <Text style={s.reason} numberOfLines={2} testID={`crew-suggestion-reason-${sg.other}`}>{why}</Text>
                    </View>
                  </PersonDoor>
                  <PressableScale
                    onPress={() => askSuggested(sg.other)}
                    hitSlop={CHIP_SLOP}
                    scaleTo={0.94}
                    style={pending.has(sg.other) ? s.working : undefined}
                    disabled={pending.has(sg.other)}
                    aria-disabled={pending.has(sg.other)}
                    accessibilityRole="button"
                  >
                    {/* Quiet (owner, 26 Oct 2026): one per row, so a
                        list of five was five filled buttons, each as
                        loud as the screen's one real decision. The
                        glass of `AddPill`'s quiet; Accept, on a
                        request made to you, stays filled. */}
                    <View style={s.addBtn} testID={`crew-suggestion-add-${sg.other}`}>
                      <Glyph name="person-add-outline" size={ICON.text} color={colors.accent} />
                      <Text style={s.addText}>{t('Add', 'Thêm', '追加', '添加', '新增')}</Text>
                    </View>
                  </PressableScale>
                  <PressableScale
                    onPress={() => dismiss(sg.other)}
                    scaleTo={0.9}
                    style={s.dismiss}
                    accessibilityRole="button"
                    accessibilityLabel={t('Hide suggestion', 'Ẩn gợi ý', 'おすすめを非表示', '隐藏推荐', '隱藏推薦')}
                    testID={`crew-suggestion-dismiss-${sg.other}`}
                  >
                    <Glyph name="close" size={ICON.action} color={colors.textTertiary} />
                  </PressableScale>
                </View>
              );
            })}
          </Card>
    </>
  )}
    </>
  );
}

/** Nothing in any section: a spinner, the failure, or the empty state. */
function Nothing(props: Props) {
  const { crew, intros, asking, failedState, addCta, t } = props;
  const nothingWaiting = crew.incoming.length === 0 && crew.outgoing.length === 0 && intros.length === 0;
  return (
    <>
      {nothingWaiting && (asking ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 28 }} />
      ) : failedState ? failedState : (
        <EmptyState
          icon="mail"
          title={t('No requests yet', 'Chưa có lời mời nào', 'リクエストはまだありません', '还没有好友请求', '還沒有好友請求')}
          // One line that is true of all three sections this tab
          // draws — requests in, requests out, suggestions — in the
          // owner's choice of words (25 Oct 2026). The longer one
          // left the sent requests out and read as if the people
          // who save your places were the ones asking.
          body={t(
            'Friend requests and suggestions show up here.',
            'Lời mời và gợi ý kết bạn sẽ hiện ở đây.',
            '友達リクエストとおすすめがここに表示されます。',
            '好友请求和推荐会显示在这里。', '好友請求和推薦會顯示在這裡。',
          )}
          testID="crew-requests-empty"
        >
          {addCta}
        </EmptyState>
      ))}
    </>
  );
}
