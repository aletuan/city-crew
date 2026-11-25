import React, { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { AmbientWarmth, Empty, Screen, useTabBarClearance } from '../components/ui';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { AddCell } from '../components/add';
import { useProfile } from '../lib/auth';
import ShareSheet from '../components/ShareSheet';
import { useCurrentCity } from '../lib/city';
import { useReport } from '../components/reportFlow';
import { useSaveActions } from '../lib/save';
import { useNoteEvent } from '../lib/tasteProfile';
import { useI18n } from '../lib/i18n';
import { colors } from '../theme';
import type { Nav, RootRoute } from '../nav';
import { useKindFilter } from './collectionDetail/useKindFilter';
import { useReorderDraft } from './collectionDetail/useReorderDraft';
import { useListVisibility } from './collectionDetail/useListVisibility';
import { useCopyRemove } from './collectionDetail/useCopyRemove';
import { useListMenu } from './collectionDetail/useListMenu';
import { ListCurator, ListFoot, ListHead, ownTagOf } from './collectionDetail/head';
import { KindRow, ListDock, MenuSheet, WhoSeesSheet } from './collectionDetail/body';
import { useCuratorFace } from './collectionDetail/useCuratorFace';
import { usePlanDock } from './collectionDetail/usePlanDock';
import { useListHeart, useListPage } from './collectionDetail/useListPage';
import { useListArrange } from './collectionDetail/useListArrange';
import { PlaceList } from './collectionDetail/list';

export default function CollectionDetailScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'CollectionDetail'> }) {
  const { t } = useI18n();
  // The list, its places, and what is true of it for this reader:
  // `useListPage` (25 Nov 2026, the fifth step of F1). `userId` keys what
  // the phone keeps per reader (`readerKey`).
  const {
    uid, userId, cols, mine, col, members, loading, pulling, reload, owned, isPublic, sharedToMe, unseen,
  } = useListPage(route.params.slug);
  const { profile } = useProfile();
  const { askToSignIn } = useSaveActions();
  // Reporting, raised from the overflow menu — see components/reportFlow.
  const { report, canReport, node: reportSheet } = useReport();
  const { city } = useCurrentCity();
  const note = useNoteEvent();
  // Who sees the list, and the three ways of changing it: the word under
  // your handle, the sheet it opens, the friends picker and the writes
  // behind all three. `useListVisibility` (23 Nov 2026, the first step of
  // F1 in the code review): it was a quarter of this function.
  const {
    listShares, sharedWith, seen, seenWord, people, friendIds, blocks,
    publishing, picking, setPicking, saveShares, whoSees, setWhoSees, whoSees3,
  } = useListVisibility({
    col, uid, owned, isPublic, mine, cols, unseen, navigation, t, arrived: route.params.seen,
  });
  // The curator's face, for a list somebody else made: `useCuratorFace`.
  const { curatorAvatar, holdForFace, found } = useCuratorFace(owned, col);
  // The shares' own list is asked again with the rest.
  const pull = () => { reload(); listShares.reload(); };
  // The heart: lit, tallied and tapped in `useListHeart`.
  const { liked, likes, onHeart } = useListHeart({ col, uid, askToSignIn });
  const tabClearance = useTabBarClearance();
  // The same scroll etiquette the tab home screens keep: reading down a
  // long list tucks the bar away, the first pull back up recalls it. A
  // collection with thirty places is as much a reading surface as the
  // Explore feed, and it was the one long list where the bar refused to
  // move. Navigation still surfaces the bar on arrival (FloatingTabBar
  // keys on the nav state), so this can only ever hide it mid-read.
  const duckScroll = useDuckOnScroll();

  const title = col ? t(col.title_en, col.title_vi, col.title_ja) : '';
  const desc = col ? t(col.desc_en, col.desc_vi, col.desc_ja) : '';
  // The list's chips and the one the reader has narrowed to: `useKindFilter`.
  const { kinds, filters, chosen, narrowed, pick, kept, setPicked } = useKindFilter(members);
  // The kinds, the count, and "4 of 11 · Clear" under them: `KindRow`.
  const kindRow = (
    <KindRow
      members={members} kinds={kinds} filters={filters} chosen={chosen}
      narrowed={narrowed} pick={pick} kept={kept} setPicked={setPicked}
    />
  );
  // Whether the ⋯'s sheet is up — see `menuSheet`.
  const [menu, setMenu] = useState(false);

  // Putting the list in order: the order on screen, the write a beat
  // after the last move, and the move itself are `useReorderDraft`.
  const { drafted, shuffle } = useReorderDraft({ col, members, mine, cols, t });

  // The cards or the grid, the places a chosen kind leaves, and the drag
  // that puts them in order: `useListArrange`.
  const kit = useListArrange({ owned, members, drafted, shuffle, narrowed, chosen, userId, navigation });
  const { grid, pickView, onScrolled, lift } = kit;

  // Saving a copy of a list and deleting your own: `useCopyRemove`, the
  // second step of F1 (23 Nov 2026). `copy` opens three doors — the ⋯,
  // the dock, the activity row — and `canCopy` says whether they show.
  const { canCopy, copy, remove } = useCopyRemove({
    col, uid, tabCityId: city?.id, sharedToMe, members, title, mine, cols, note, askToSignIn, navigation, t,
  });

  // Planning a trip from the list, and the dock that offers it once the
  // card has scrolled away: `usePlanDock`, which has the argument.
  const { plan, canPlan, dock, onListScroll, onCardLayout } = usePlanDock({
    col, members, navigation, duckScroll, onScrolled, lift,
  });
  // The ⋯'s sheet: its rows, the two views, and the presses only it and
  // the card make (Add place, Edit). `useListMenu`, the second step of F1.
  const { viewRows, addPlace, edit, actsBefore, actsAfter, commentsSetting } = useListMenu({
    col, owned, sharedToMe, grid, pickView, title, desc, navigation, t,
    canPlan, plan, canCopy, copy, remove, canReport, report,
  });

  /* ── the description, in a card ──
      It was bare grey body text under the header, and read as one
      more line of the header. The owner's review (15 Oct 2026) put it
      in a card on `surfaceCard` — the surface the place screen's
      address card and its "City Crew chọn" card already wear, so it
      follows the look chosen in Profile and adds no colour of its
      own. Not the accent as a surface: that is for state the reader
      just made (`theme.ts`), and a description is not one.

      ── the corner (owner, 13 Nov 2026) ──
      From 15 Oct the owner's corner held a pencil that opened the same
      form as the menu's "Edit collection", and from 27 Oct a visitor's
      held "Save a copy" — each a second door to a row of the menu, on
      the card it was about. The ⋯ has the corner now (`more`), and the
      rows are the one door to each: a pencil or a copy beside the ⋯
      would have been two controls in one corner for acts the ⋯ already
      holds.

      ── the note glyph (owner, 15 Oct 2026) ──
      On somebody else's list nothing said whose words these were, and
      the card could read as the app's own copy. The page with lines
      says "a note", which is the one fact it adds. 20pt in
      `textSecondary`, the card's one secondary ink. The curator's face
      took its place on 16 Oct; it stays only on your own list with no
      handle yet.

      ── the face, the foot (owner, 16 Oct 2026) ──
      On somebody else's list the curator's face and handle now lead
      the card where the note glyph was (see `curatorRow`), and every
      card ends in a foot with the place count and the heart, both
      moved down from the header. So the card is drawn on every list, a
      visitor's included. Your own list leads with your own face (see
      `ownTag`); the note glyph returns only without a handle. Since
      13 Nov 2026 the count is at the end of the kinds' row, and the
      foot is the activity row (`activity`), drawn on every card.

      An owner's list with no description still invites one: the line
      opens the form.

      Checked on the text `t` picks, not on a hand-listed pair of
      columns: that left a Japanese-only description never drawn.

      ── the chips (owner, 15 Oct 2026) ──
      Under the words, in the same card, because they answer the same
      question — what is this list — and one form edits both. They
      are every kind the places carry, most places first
      (`lib/collectionKinds`), drawn as `KindPill` — the
      pill a place's card and page wear, a dot in the category's
      colour and its word. They are also the list's filter (see "the
      chips are the filter"), lit in the accent while chosen. */
  /* ── in the list, not over it (owner, 16 Oct 2026) ──
     The card scrolls away with the places now. Held above the list it
     kept a sixth of the screen — a third with a long note — for words
     read once on arrival, and every place card paid for it. The title
     stays in the header, so the reader never loses which list this is.
     The chips go with it: you filter first and then read, and a filter
     row pinned over the places would be the same tax again. */
  /* ── "Add place" in the list (owner, 22 Oct 2026) ──
     From the owner's two mockups: in the grid the first cell, dashed, a
     tile among tiles; in the list a dashed row over the first card. Adding
     a place is the owner's everyday edit, and until now it lived in the ⋯
     menu and in the dock — which only rises once the card has scrolled
     away. Here it is where the places are, on arrival.

     First, not last. A list of twenty would put the last cell seven rows
     down, and the reader who wants to add has just opened the list. It
     leaves with the card as the list scrolls, which is about when the
     dock's "+ Địa điểm" comes up: the one offer hands over to the other.

     Only on your own list, and not on an empty one: there the card
     under the header already hands you the way (`OwnEmpty`), and two
     offers of one act read as two acts. While a filter narrows the list
     it stays: the place you add is added whatever is shown. It goes
     where the ⋯ menu's row and the dock's pill go, `addPlace`. */
  // The list's count rode the cell from 2 Nov; since 13 Nov it is on the
  // card, at the end of the kinds' row — see `kindRow`.
  const addCell = (size?: number) => (
    <AddCell
      label={t('Add place', 'Thêm địa điểm', 'スポットを追加', '添加地点', '新增地點')}
      onPress={addPlace}
      size={size}
      testID="collection-add-cell"
    />
  );
  const introCard = (
    <ListHead
      col={col} owned={owned} ownTag={owned ? ownTagOf(profile) : ''} desc={desc}
      members={members} from={route.params.from} onEdit={edit} onMore={() => setMenu(true)}
      onCoverChanged={() => { mine.reload(); if (col?.is_public) cols.reload(); }}
      kinds={kindRow}
      curator={(
        <ListCurator
          col={col} owned={owned} profile={profile} curatorAvatar={curatorAvatar} holdForFace={holdForFace}
          found={found} seen={seen} seenWord={seenWord} onWhoSees={() => setWhoSees(true)} navigation={navigation}
        />
      )}
      foot={(
        <ListFoot
          col={col} uid={uid} owned={owned} isPublic={isPublic} sharedCount={sharedWith.length} liked={liked}
          likes={likes} onHeart={onHeart} title={title} canCopy={canCopy} copy={copy} seen={seen}
          onWhoSees={() => setWhoSees(true)} navigation={navigation}
        />
      )}
    />
  );

  return (
    <Screen
      title={title}
      onBack={() => navigation.goBack()}
      backTestID="collection-back"
      backBare compactTitle
    >
      <AmbientWarmth />
      {loading && members.length === 0 && <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />}
      {!loading && !col && <Empty text={t('Collection not found.', 'Không tìm thấy bộ sưu tập.', 'コレクションが見つかりません。', '找不到这个合集。', '找不到這個合集。')} />}
      <PlaceList
        kit={kit} introCard={introCard} addCell={addCell} onAdd={addPlace} onCardLayout={onCardLayout}
        onScroll={onListScroll} onRefresh={pull} refreshing={pulling} loading={loading} found={!!col}
        owned={owned} narrowed={narrowed} kinds={kinds} chosen={chosen} foot={tabClearance}
      />

      <MenuSheet
        title={title} menu={menu} setMenu={setMenu} actsBefore={actsBefore} viewRows={viewRows} actsAfter={actsAfter}
      />
      <ListDock dock={dock} plan={plan} owned={owned} canCopy={canCopy} addPlace={addPlace} copy={copy} />
      {reportSheet}
      {col && owned ? (
        <ShareSheet
          open={picking}
          isPublic={isPublic}
          friendIds={friendIds}
          blocked={blocks.data}
          people={people}
          shared={sharedWith}
          sending={publishing}
          onClose={() => setPicking(false)}
          onSave={(add, remove) => saveShares(col, add, remove)}
          history={listShares.data}
        />
      ) : null}
      <WhoSeesSheet whoSees={whoSees} setWhoSees={setWhoSees} whoSees3={whoSees3} />
      {commentsSetting.node}
    </Screen>
  );
}
