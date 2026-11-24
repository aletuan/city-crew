// Everything above the shelf: the title and its "+ New", the line under
// it, the tabs and the view toggle, the search box, its kinds and its
// suggestions — drawn twice, as the list's own header and as the copy
// pinned at the top once the list has carried it there (`floating`).
//
// Out of CollectionsScreen since 24 Nov 2026. These were three functions
// inside the screen's one function (`top` at complexity 36, `tabsRow`,
// `kindsRow`), reading two dozen of its values from the closure; they
// read them from `ShelfHead`, one object the screen builds, so what the
// header depends on is written in one place. The lines were moved, not
// retyped.
import type React from 'react';
import { View, Text, type TextInput } from 'react-native';
import SearchField from '../../components/SearchField';
import { HeaderAdd } from '../../components/add';
import { Card, PressableScale, ScreenTitle, UnderlineChoice, WordTabs } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import { CATEGORIES, categoryLabel } from '../../lib/categories';
import type { Collection } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { colors } from '../../theme';
import { s } from './styles';

/**
 * How many lists a tab holds, for its pill (owner, 20 Nov 2026) — or
 * nothing until every source the tab is drawn from is in.
 *
 * Counted from the very lists the tab draws, never asked of the server:
 * a count of public lists there was 66 the day this was written, where
 * the tab shows the ones with a place in the catalog, and a pill that
 * disagrees with the cards under it is worse than none. Nor is a second
 * request quicker: the catalog and your lists open from the phone's own
 * copy, `catalog:collections(cached)` at 368ms after launch in the one
 * measured start (docs/tracing.md), before a reader reaches this tab;
 * the fresh answer comes some 2.7s later and replaces it, which moves the
 * figure only when a list was really added or taken away.
 *
 * Nothing while a source is still out, rather than the 0 it holds then:
 * on a first launch with no copy on the phone the pill arrives once,
 * with the cards, instead of counting up from nothing. Community's own
 * list is the public lists with a place in the catalog (`community`), so
 * it includes the reader's own published ones, as the tab does.
 */
const tallyOnceIn = (ready: boolean[], n: number): number | undefined => (ready.every(Boolean) ? n : undefined);

/** What the header reads of the screen around it. */
export type ShelfHead = {
  session: object | null;
  pinned: boolean;
  topHRef: React.MutableRefObject<number>;
  tabsYRef: React.MutableRefObject<number>;
  startNew: () => void;
  onYours: boolean;
  holding: boolean;
  open: boolean;
  headerExpanded: boolean;
  inputRef: React.RefObject<React.ComponentRef<typeof TextInput> | null>;
  query: string;
  setQuery: (q: string) => void;
  setPanel: (on: boolean) => void;
  noteSearch: () => void;
  cancel: () => void;
  panel: boolean;
  suggestions: string[];
  keepRecents: (terms: string[]) => void;
  answered: () => void;
  community: Collection[];
  mine: { loaded: boolean; data: unknown[] };
  shared: { loaded: boolean; data: unknown[] };
  communityRef: React.Ref<React.ComponentRef<typeof View>>;
  tab: 'yours' | 'community';
  pickTab: (next: 'yours' | 'community') => void;
  communityView: 'tile' | 'mosaic';
  pickCommunityView: (v: 'tile' | 'mosaic') => void;
  kindChoices: string[];
  kind: string | null;
  kindCounts: Map<string, number>;
  setKind: (k: string | null) => void;
  wordsCount: number;
};


  // Words alone since 20 Nov 2026, as Crew's and Activity's are
  // (`WordTabs`); the bookmark and the globe that marked the two went.
  // The view toggle at the row's end keeps its glyphs: they are the two
  // views, not names. Guests have no library, so they
  // get the one half with no switch in front of it. Drawn twice: in the
  // list, where it is measured (`tabsY`), and as the pinned copy once
  // the list has carried it to the top — see `pinned`. The copy has no
  // test names, so a test finds exactly one of each.
  //
  // ── Community stands first; where the tab opens did not move (owner,
  //    19 Nov 2026) ──
  //
  // Yours led until this day. The order is the reading order of what the
  // app is becoming — collections as the thing people meet over
  // (`docs/collection-feed-plan.md`) — and for a reader with no list yet
  // Community is all there is, so it is the first word they read.
  //
  // Which one is open is a different question and has the answer it had:
  // Yours for a reader with a list of their own or one a friend shared
  // with them, Community for one with neither (`greeted`, above). Weighed
  // with the order and not taken: opening on Community for everybody. A
  // reader with fifteen lists comes here to open one or add to one, and
  // would pay a press each time; "+ New" and "Places of your own" would
  // stand over lists that are not theirs; and a list a friend had just
  // shared with them is on Yours, behind the tab they were not shown.
  //
  // So a reader with lists arrives with the second tab lit, not the
  // first. That is the cost of taking the order without the default, and
  // the tab bar's own pill is the same sight every day.
export function TabsRow({ h, floating }: { h: ShelfHead; floating: boolean }) {
  const { t } = useI18n();
  const { session, holding, community, mine, shared, communityRef, tab, pickTab, onYours, communityView, pickCommunityView } = h;
  return (session ? (
      <WordTabs
        tabs={[
          { key: 'community', testID: floating ? undefined : 'collections-community', anchorRef: floating ? undefined : communityRef, label: t('Community', 'Cộng đồng', 'みんなの', '社区', '社群'), tally: tallyOnceIn([!holding], community.length) },
          { key: 'yours', label: t('Yours', 'Của bạn', '自分の', '我的', '我的'), testID: floating ? undefined : 'collections-yours', tally: tallyOnceIn([mine.loaded, shared.loaded], mine.data.length + shared.data.length) },
        ]}
        active={tab}
        onChange={pickTab}
        // Community's two looks; Yours is the grid and has no switch
        // (owner, 7 Nov 2026 — the list view went from both).
        right={onYours ? undefined : (
          <View style={s.viewToggle}>
            {(['tile', 'mosaic'] as const).map((v) => (
              <PressableScale
                key={v}
                contentStyle={[s.viewBtn, communityView === v && s.viewBtnOn]}
                scaleTo={0.9}
                haptic="selection"
                // Keep the capsule compact; extend the outer edges and the
                // vertical hit area without overlapping the other mode.
                hitSlop={v === 'tile'
                  ? { top: 11, bottom: 11, left: 18, right: 1 }
                  : { top: 11, bottom: 11, left: 1, right: 18 }}
                onPress={() => pickCommunityView(v)}
                accessibilityRole="button"
                accessibilityState={{ selected: communityView === v }}
                aria-selected={communityView === v}
                testID={floating ? undefined : `collections-view-${v}`}
                accessibilityLabel={v === 'mosaic'
                  ? t('Mosaic view', 'Dạng Mosaic', 'モザイク表示', '拼贴视图', '拼貼檢視')
                  : t('Tile view', 'Dạng lưới', 'タイル表示', '卡片视图', '卡片檢視')}
              >
                <Glyph
                  name={v === 'mosaic' ? 'albums-outline' : 'grid-outline'}
                  size={ICON.text}
                  color={communityView === v ? colors.accent : colors.textTertiary}
                />
              </PressableScale>
            ))}
          </View>
        )}
      />
  ) : null);
}

  // The kinds, under the box while it is open: a kind narrows the shelf
  // to lists holding that kind of place, and a card says how many of its
  // places those are. "All" first, Explore's row; a kind that would leave
  // nothing is drawn off, not hidden, so the row does not reflow as the
  // words change. A kind is an answer: tapped, the keyboard goes.
function KindsRow({ h, floating }: { h: ShelfHead; floating: boolean }) {
  const { t } = useI18n();
  const { holding, open, kindChoices, kind, kindCounts, setKind, answered, wordsCount } = h;
  return (!holding && open && kindChoices.length > 0 ? (
    <View style={s.kinds}>
      <UnderlineChoice
        // The chosen kind stays in the row even where this shelf holds
        // none of it (carried over from the other tab), or it could be
        // on and nowhere in sight.
        items={(kind && !kindChoices.includes(kind) ? [...kindChoices, kind] : kindChoices).map((k) => ({
          key: k,
          label: categoryLabel(k, t),
          icon: CATEGORIES[k]?.icon,
          count: kindCounts.get(k) ?? 0,
          off: (kindCounts.get(k) ?? 0) === 0,
          testID: floating ? undefined : `collections-kind-${k}`,
        }))}
        chosen={kind}
        onPick={(k) => { setKind(k); answered(); }}
        all={t('All', 'Tất cả', 'すべて', '全部', '全部')}
        allCount={wordsCount}
        testID={floating ? undefined : 'collections-kinds'}
      />
    </View>
  ) : null);
}

  // Everything above the shelf, as the list's own header since 25 Oct
  // 2026 (owner): the title, the line under it, the tabs, the box and its
  // panel go up with the shelf, as Explore's hero does, and the tabs pin
  // at the top once they get there. Fixed, they took a third of the phone
  // from the lists. Measured, for the dock: past its foot is "deep".
export function ShelfTop({ h, floating = false }: { h: ShelfHead; floating?: boolean }) {
  const { t } = useI18n();
  const {
    session, pinned, topHRef, tabsYRef, startNew, onYours, holding, open, headerExpanded, inputRef,
    query, setQuery, setPanel, noteSearch, cancel, panel,
  } = h;
  // The list's own copy, while the pinned one stands in for it: kept for
  // its height, out of reach of touch and of VoiceOver. Five props asked
  // it, each spelling it out.
  const stoodIn = !floating && pinned && !!session;
  return (
    <View
      onLayout={floating ? undefined : (e) => { topHRef.current = Math.round(e.nativeEvent.layout.height); }}
      testID={floating ? 'collections-floating-top' : 'collections-top'}
      // Preserve layout while exposing only one copy to touch and a11y.
      style={stoodIn ? [s.hiddenHeader, { height: topHRef.current }] : undefined}
      pointerEvents={stoodIn ? 'none' : 'auto'}
      accessibilityElementsHidden={stoodIn}
      importantForAccessibility={stoodIn ? 'no-hide-descendants' : 'auto'}
      aria-hidden={stoodIn}
    >
      <ScreenTitle
        title={t('Collections', 'Bộ sưu tập', 'コレクション', '合集', '合集')}
        right={session ? (
          <HeaderAdd
            label={t('New collection', 'Bộ sưu tập mới', '新しいコレクション', '新建合集', '新增合集')}
            onTitle
            onPress={startNew}
            testID={floating ? 'collection-floating-new' : 'collection-new'}
          />
        ) : undefined}
      />
      {/* What the tab is, in a sentence — the two lines of 2 Nov 2026,
          back on 7 Nov (owner) after a day without them: at rest the
          screen went from the tabs straight into photographs, with
          nothing saying which shelf this was. Static now: the answer line
          a search once turned it into stays gone (the kinds row counts).
          In the body, as the Trips lede is, and not the header's `lede`:
          the header row aligns its right slot to the bottom of the title
          column, so a line in that column drops the pill a line below
          the title (14 Oct 2026). */}
      <Text style={s.scope} numberOfLines={1} testID={floating ? 'collections-floating-scope' : 'collections-scope'}>
        {onYours
          ? t('Your own favourite places.', 'Nơi chốn yêu thích của riêng bạn.', 'あなただけのお気に入りの場所。', '专属于你的心仪去处。', '專屬於你的心儀去處。')
          : t('Good corners, through the community’s eyes.', 'Những góc hay, qua lăng kính cộng đồng.', 'みんなの目で見つけた、いい場所。', '社区眼中的好去处。', '社群眼中的好去處。')}
      </Text>
      <View onLayout={floating ? undefined : (e) => { tabsYRef.current = Math.round(e.nativeEvent.layout.y); }} testID={floating ? 'collections-floating-tabs' : 'collections-tabs'}>
        <TabsRow h={h} floating={floating} />
      </View>
      {/* The box, and the panel it opens. It stood outside the list
          until 25 Oct 2026 — a box that scrolled away with the shelf was
          the one the owner's review of 14 Oct called hard to find — and
          goes up with the shelf now, because the dock brings it back from
          any depth (`findFromDock`) and the screen it took is the lists'.
          Since 7 Nov 2026 it is drawn only while open (see `searching`). */}
      {!holding && open && (
        <View style={s.searchRow}>
          <SearchField
            inputRef={stoodIn && headerExpanded ? undefined : inputRef}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setPanel(true)}
            // Opened by the dock, it comes up ready for words.
            // The pinned copy never takes focus of its own accord.
            autoFocus={!floating}
            onSubmitEditing={noteSearch}
            testID={{ input: floating ? 'collections-floating-input' : 'collections-input', cancel: floating ? 'collections-floating-cancel' : 'collections-cancel' }}
            // The four things it answers by, named in the box itself.
            // A person, not "@username" (owner, 21 Oct 2026): on a phone
            // the box cut it to "@use…", which read as nothing, and the
            // search finds a curator by the handle typed with or without
            // the @ anyway. No "or": a list of four needs no conjunction
            // to be read as one.
            placeholder={t('Name, place, city, user', 'Tên, địa điểm, thành phố, người dùng', '名前・スポット・都市・ユーザー', '名称、地点、城市、用户', '名稱、地點、城市、使用者')}
            // Inside the box, while the panel is up or anything it chose
            // is still on — see `SearchField`.
            // Always, while it is open: Cancel is how it is put away.
            cancel={{ shown: true, label: t('Cancel', 'Huỷ', 'キャンセル', '取消', '取消'), onPress: cancel }}
          />
        </View>
      )}
      <KindsRow h={h} floating={floating} />
      {/* Drawn only when there is something in it: the box's own
          placeholder already says what it answers, and a hint under it
          saying the same was the owner's to strike (25 Oct 2026). */}
      {!holding && panel && <Suggestions h={h} floating={floating} />}
    </View>
  );
}

/** The terms searched before, under the open box; nothing when there are none. */
function Suggestions({ h, floating }: { h: ShelfHead; floating: boolean }) {
  const { t } = useI18n();
  const { suggestions, keepRecents, setQuery, answered } = h;
  if (suggestions.length === 0) return null;
  return (
    <View style={s.panel} testID={floating ? 'collections-floating-panel' : 'collections-panel'}>
      <Card style={s.recents}>
        <View style={s.legendRow}>
          <Text style={s.legend}>{t('Suggestions', 'Gợi ý', '候補', '推荐', '推薦')}</Text>
          <PressableScale
            onPress={() => keepRecents([])}
            scaleTo={0.92}
            hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={t('Clear suggestions', 'Xoá gợi ý', '候補を消去', '清除推荐', '清除推薦')}
          >
            <Text style={s.clear}>{t('Clear', 'Xoá', '消去', '清除', '清除')}</Text>
          </PressableScale>
        </View>
        {suggestions.map((term) => (
          <PressableScale
            key={term}
            contentStyle={s.suggestion}
            scaleTo={0.97}
            onPress={() => { setQuery(term); answered(); }}
            accessibilityRole="button"
            accessibilityLabel={term}
          >
            <Glyph name="search-outline" size={ICON.action} color={colors.textTertiary} />
            <Text style={s.suggestionText} numberOfLines={1}>{term}</Text>
          </PressableScale>
        ))}
      </Card>
    </View>
  );
}
