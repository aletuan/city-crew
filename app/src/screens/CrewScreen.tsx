// Your crew — the people you plan with, and the people you might.
//
// Two tabs, because the screen answers two different questions and they
// arrive at different moments. **Requests** is the inbox and the outbox:
// who is waiting on you, who you are waiting on, and — new here — who
// the shelves say you would get on with. **Your friends** is the state
// you arrived at: the crew itself, and the boundaries you have drawn.
//
// One list held all of it before, and the order was a compromise nobody
// won: requests buried under the friend list on a busy account, the
// friend list pushed off-screen by three pending rows on a new one. A
// tab is the honest fix — each half gets the top of the screen when it
// is the half you came for, and the count on the Requests tab says when
// that is without you having to look.
//
// Adding by exact @handle is still the only way to reach a *particular*
// person: nobody is browsable and the lookup only ever answers about the
// one account you named. Suggestions are the other direction — the app
// naming people for a reason it can state: they liked or copied a list
// of yours, you liked or copied theirs, or their public lists hold places
// you saved or went to (see friend_suggestions, which invents no
// visibility: everything of theirs it reads is on a public shelf). The pure half of all of it — which pile an edge is in,
// what stands between two accounts, which suggestions are still open —
// lives in lib/friends, under the gate.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import PersonSheet from '../components/PersonSheet';
import { EmptyState, GradientCta, INK_GAP_END, RoundIconButton, Screen, useTabBarClearance, WordTabs } from '../components/ui';
import { useSession } from '../lib/auth';
import { useCrew } from '../lib/crew';
import { splitFriendships } from '../lib/friends';
import { useI18n } from '../lib/i18n';
import { space } from '../theme';
import type { Nav } from '../nav';
import { useCrewActions } from './crew/useCrewActions';
import { useIntros } from './crew/useIntros';
import { useCrewSheets } from './crew/useCrewSheets';
import { RequestsTab } from './crew/RequestsTab';
import { FriendsTab } from './crew/FriendsTab';

type Tab = 'requests' | 'friends';

export default function CrewScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { session } = useSession();
  const me = session?.user?.id ?? null;
  const tabClearance = useTabBarClearance();
  // One copy for the whole app — edges, faces and counts arrive from the
  // provider, usually before this screen has ever been opened, which is
  // what took the seconds out of Profile → Crew.
  const { ships, blocks, people, mutual, absorb } = useCrew();

  // ...and recounted on every RETURN visit. Mutations made here tell the
  // provider themselves, and backgrounding is covered by its AppState
  // refresh — but a request sent by somebody ELSE while the app stayed
  // open reached this screen as a stale number until the next foreground.
  // The numbers on the tabs are promises about what is inside, so each
  // visit asks the server again: the held answer still paints first, and
  // a number moves in place only when the truth did.
  //
  // Every focus reloads, including the first — the skip #353 added here
  // assumed the mount was covered by the provider's own launch fetch, on
  // the theory that reloading again straight after was the whole wave
  // running twice for nothing. That held only because nothing had had a
  // chance to write to friendships between launch and that first look; it
  // does not hold once Crew is reached by way of another tab that could
  // have just sent or answered a request. See TripsScreen for the full
  // argument and the shape this bug takes when the skip is wrong instead
  // of merely redundant.
  //
  // What #353 actually needed is kept: `shipsRef.current.loading` guards
  // against firing a *second, concurrent* request while the provider's
  // own launch fetch is still in flight — the literal "twice per open" —
  // without also skipping a reload that is genuinely owed.
  const shipsRef = useRef(ships);
  shipsRef.current = ships;
  useFocusEffect(useCallback(() => {
    if (!shipsRef.current.loading) shipsRef.current.reload();
  }, []));

  const crew = useMemo(() => splitFriendships(ships.data, me ?? ''), [ships.data, me]);

  const [tab, setTab] = useState<Tab>('friends');
  // Opened on Requests when somebody is actually waiting — but only the
  // first time the edges land, and never again. A tab that re-picks
  // itself on every reload would move under a reader who chose the other
  // one, which is the difference between a helpful default and a screen
  // arguing with you.
  const chosen = useRef(false);
  useEffect(() => {
    if (chosen.current || ships.loadedAt === null) return;
    chosen.current = true;
    if (crew.incoming.length > 0) setTab('requests');
  }, [ships.loadedAt, crew.incoming.length]);

  // The introductions: who, why, and the ones put away this visit
  // (`useIntros`).
  const { intros, titles, suggesting, askSuggestions, setDismissed } = useIntros({ me, ships, blocks, absorb });

  // The add flow and every write on this page — ask, answer, unfriend,
  // block, unblock: `useCrewActions` (23 Nov 2026). The screen keeps the
  // sheets and the confirmations; the hook does the writing.
  const actions = useCrewActions({ me, ships, blocks, setDismissed, t });
  const { adding, setAdding, setNote, setFound, pending, answer, cutEdge, bar, unblock } = actions;

  // The ⋯ sheets and the confirmations behind them (`useCrewSheets`).
  const sheets = useCrewSheets({ t, people, bar, cutEdge, answer, unblock });
  const { sheet, setSheet, reportSheet } = sheets;

  // ── empty, and failed (owner, 25 Oct 2026) ──
  //
  // Both tabs said "nothing" in one grey line, and both said it when the
  // friendships could not be read at all — offline, the Friends tab told
  // the reader they had no friends. A list that could not be read is now
  // said as one, with Try again, wherever there is nothing else to show
  // (the blocked list below has done this since it was written). Empty
  // is an `EmptyState` with the one step that ends it: the header ⊕'s
  // own words, "Add a friend", opening the same field on Requests — on
  // both tabs, since it is one act, and not while the field is open.
  const shipsFailed = !!ships.error && ships.data.length === 0;
  // The spinner in place of a tab's empty state: only while the edges
  // have never been answered — the launch before the provider's first
  // fetch, or Try again after a failure that kept nothing. A reload of an
  // answer already held, empty or not, keeps the page as drawn: every
  // focus reloads (above), and so does a pull (below), and the empty
  // state used to swap for a spinner and back on each.
  const shipsAsking = ships.loading && ships.loadedAt === null;
  const openAdd = () => {
    setTab('requests');
    setAdding(true);
    setNote(null);
    setFound([]);
  };
  const addCta = adding ? null : (
    <GradientCta
      icon="person-add"
      label={t('Add a friend', 'Thêm bạn', '友達を追加', '添加好友', '新增好友')}
      onPress={openAdd}
      testID="crew-empty-add"
    />
  );
  const failedState = (
    <EmptyState
      icon="cloud-offline"
      title={t("Couldn't load your crew", 'Không tải được danh sách bạn bè', '友達を読み込めませんでした', '无法加载好友', '無法載入好友')}
      body={t('Check your connection and try again.', 'Kiểm tra kết nối rồi thử lại.', '接続を確認して、もう一度お試しください。', '请检查网络连接后重试。', '請檢查網路連線後重試。')}
      testID="crew-failed"
    >
      <GradientCta icon="refresh" label={t('Try again', 'Thử lại', '再試行', '重试', '重試')} onPress={() => ships.reload()} testID="crew-retry" />
    </EmptyState>
  );

  // ── a pull (owner, 13 Nov 2026) ──
  //
  // Pulling the list down asks again for everything the two tabs draw
  // from: the edges (`ships` — friends, requests in and out), the blocks,
  // and the introductions. A suggestion's faces and list names follow the
  // suggestions. The crew's faces and shared-taste counts follow the
  // edges, but only when the edges changed (`lib/crew`, the fingerprint
  // #353 needed), so a pull that brings the same edges back asks neither
  // again. Left so: a face or a count that moved with no edge moving is
  // not what a pull here is for, and asking them on every pull would
  // undo that fix for the one gesture made most often on an unchanged
  // list. What is drawn stays drawn: a reload behind a held answer draws
  // no spinner of its own (`shipsAsking`), and the rows change in place
  // when the answers land.
  //
  // Not twice: the focus reload above can still be out when the reader
  // pulls, and a second `reload` would start the edges over and drop the
  // answer already on its way (`usePersistedFetch`), the double fetch
  // #353 was about. So a fetch already in flight is left alone, and the
  // spinner waits for it as for one of its own. The spinner belongs to the pull, as on the
  // collection page: armed by the gesture, disarmed when what it waits on
  // settles, and never lit by the focus reload or the provider's
  // return-to-app refresh.
  const reloading = ships.loading || blocks.loading || suggesting > 0;
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && !reloading) setPulling(false);
  }, [pulling, reloading]);
  const pull = () => {
    setPulling(true);
    if (!ships.loading) ships.reload();
    if (!blocks.loading) blocks.reload();
    if (suggesting === 0) askSuggestions();
  };

  return (
    <Screen
      // "Kết nối bạn bè" (owner, 12 Nov 2026), the words on the Profile
      // row and the guest hub that open this screen: the door and the
      // room had two names. It was "Thông tin bạn bè" (12 Oct), but the
      // screen holds no one's details — it is the list, the requests and
      // the way to add — and "Bạn bè" alone is the name of a tab inside
      // it. Not "crew" in Vietnamese: there the word is foreign and
      // belongs to the app's name only, so this screen, the invitation
      // line and the block alert say "bạn bè". The English keeps the
      // brand's word.
      title={t('Your crew', 'Kết nối bạn bè', 'あなたのクルー', '你的好友', '你的好友')}
      compactTitle
      /* No subtitle. It held a count once, then the motto alone once
         the count moved to the Friends tab — and a motto under a title
         is marketing copy where navigation belongs (HIG). A line under
         a title is for a fact about the list: a count, a window, a
         freshness. This screen's one fact is on the tab, so the slot
         stays empty rather than filled (8 Oct 2026). */
      onBack={() => navigation.goBack()}
      // Both header controls without their glass discs (owner, 12 Nov
      // 2026): the first screen to try it, before any other does.
      backBare
      right={(
        <RoundIconButton
          bare
          // Hung past the right margin by the glyph's own empty edge, so
          // its ink ends where the list's card does: bare, the empty half
          // of the 44pt box left it short of that line (owner's phone,
          // 12 Nov 2026). The chevron opposite does the same on the left
          // (`BACK_HANG`).
          style={{ marginRight: -INK_GAP_END['person-add-outline'] }}
          icon="person-add-outline"
          label={t('Add a friend', 'Thêm bạn', '友達を追加', '添加好友', '新增好友')}
          testID="crew-add"
          // The field belongs with the asking, so the control that opens
          // it takes you there — pressing ⊕ from the friends list and
          // getting a box on a screen about somebody else would be the
          // header talking past the page.
          onPress={() => {
            setTab('requests');
            setAdding((v) => !v);
            setNote(null);
            setFound([]);
          }}
        />
      )}
    >
      {/* Words alone since 20 Nov 2026, tried here before any other
          screen: `WordTabs` has why, and what it gave up. */}
      <WordTabs
        tabs={[
          { key: 'requests', label: t('Requests', 'Lời mời', 'リクエスト', '好友请求', '好友請求'), count: crew.incoming.length, testID: 'crew-tab-requests' },
          // A tally, not a count: how many friends is a fact, not news,
          // so it sits in the name in both states and never rings the
          // unchosen-tab bubble the way waiting requests do.
          { key: 'friends', label: t('Your friends', 'Bạn bè', '友達', '你的好友', '你的好友'), tally: crew.friends.length, testID: 'crew-tab-friends' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.page, paddingTop: 4, paddingBottom: tabClearance, gap: space.cardGap,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={pull} />}
      >
        {tab === 'requests' ? (
          <RequestsTab
            t={t} navigation={navigation} crew={crew} people={people} actions={actions} sheets={sheets}
            intros={intros} titles={titles} asking={shipsAsking} failedState={shipsFailed ? failedState : null} addCta={addCta}
          />
        ) : (
          <FriendsTab
            t={t} navigation={navigation} friends={crew.friends} people={people} mutual={mutual} blocks={blocks}
            pending={pending} sheets={sheets} asking={shipsAsking} failedState={shipsFailed ? failedState : null} addCta={addCta}
          />
        )}
      </ScrollView>

      <PersonSheet
        visible={sheet !== null}
        name={sheet?.name ?? ''}
        meta={sheet?.meta}
        avatarUrl={sheet?.avatar}
        actions={sheet?.actions ?? []}
        onClose={() => setSheet(null)}
      />
      {reportSheet}
    </Screen>
  );
}
