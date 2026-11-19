// A subject's thread of comments (C3 of `docs/comments-plan.md`), and
// the field at its foot that one is written in (C4).
//
// ── a screen, not a sheet (owner, 18 Nov 2026) ──
//
// Instagram opens comments in a sheet over the photograph; Threads opens
// a post as a page. This is a page: a nested thread and a keyboard want
// the whole height (in a sheet two thirds tall, the keyboard leaves two
// lines of the comment being answered), Activity's "replied to you" (C7)
// needs somewhere with an address to land, and the quick look a sheet is
// good for is already on the card, which previews two.
//
// ── what it is handed ──
//
// A `Subject`, and nothing about what kind of thing that is. The title
// is "Comments" whatever is discussed; the door it was opened from is
// the reader's way back to the list.
//
// ── what is drawn ──
//
// `lib/comments.threadOf` arranges the server's flat answer; this draws
// it. Roots newest first (decision 10), each with what was said under it.
//
// Under a root, the first `REPLIES_SHOWN` rows and then one line, "View
// N more replies", that opens the rest of that branch and stays open:
// Facebook's and Instagram's fold, and the reason is theirs — one long
// argument under the newest comment should not stand between a reader
// and every other comment on the list.
//
// Roots arrive a page at a time as the reader nears the end
// (`lib/feed.nearEnd`, as a person's page adds cards), `PAGE` at a time.
// The whole thread is already in memory — one answer, see
// `lib/data/comments.fetchThread` — so this is rows not yet mounted, not
// a request.
//
// ── writing (owner, 18 Nov 2026) ──
//
// A field at the foot of the page, as Threads has (`CommentComposer`,
// where the day this was a form of its own is written down). The tab
// bar floats where the field has to be, so this page holds the bar away
// while it is in front (`useTabBarAway`) and gives it back to whatever
// is opened from it — a person's page — and on leaving.
//
// "Reply" under a comment opens nothing: it names that comment as what
// the field's next words answer, and puts the cursor in the field. The
// page is wrapped in a `KeyboardAvoidingView`, so the field rides up on
// the keyboard and the thread shortens above it.
//
// Sent, the app is told (`commentsChanged`) and this page's own query
// asks again, as the cards' counts do. Nothing is drawn ahead of the
// server, which is what decides whether a comment exists.
//
// Signed out, the field is a press that raises the sign-in sheet, and
// so is "Reply".
//
// ── states ──
//
// A spinner while the first answer is out; "No comments yet" for an
// empty thread; a failure with Try again when there is nothing to show,
// and the rows kept when a refresh fails behind them. A pull asks again.
// A subject the reader may not see comes back empty from the server and
// reads as no comments: the list went private while this page was open,
// and saying so here would tell a stranger that it exists.

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CommentComposer from '../components/CommentComposer';
import CommentRow, { INDENT } from '../components/CommentRow';
import { useKeyboardUp } from '../components/keyboard';
import { useCommentHearts } from './comments/useCommentHearts';
import { useCommentMenu } from './comments/useCommentMenu';
import { useThreadOwner } from './comments/useThreadOwner';
import { useThreadWriting } from './comments/useThreadWriting';
import { EmptyState, GradientCta, PressableScale, Screen } from '../components/ui';
import { useTabBarAway } from '../components/tabBarDuck';
import { agoLabel } from '../lib/ago';
import { threadOf, type Branch } from '../lib/comments';
import { useTaggableQuery, useThreadQuery } from '../lib/data';
import { nearEnd } from '../lib/feed';
import { useProfile, useSession } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useSaveActions } from '../lib/save';
import { colors, font, space } from '../theme';
import type { Nav, RootRoute } from '../nav';

/** How many roots are drawn at first, and added each time the reader
 *  nears the end. A root with two answers is about 3 × 60pt, so ten fill
 *  two screens of 852: the first reach comes after a screen of reading.
 *  Drawn to scale, not measured on a phone. */
export const PAGE = 10;
/** How many rows under a root are drawn before the fold. Two: enough to
 *  show that there is a conversation and who is in it — what the feed
 *  card previews of a whole thread, for the same reason. */
export const REPLIES_SHOWN = 2;

export default function CommentsScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'Comments'>;
}) {
  const { t, lang } = useI18n();
  const thread = useThreadQuery(route.params.subject);
  const branches = useMemo(() => threadOf(thread.data), [thread.data]);

  // Which branches the reader has opened past the fold. By the root's id,
  // so a refresh that reorders nothing keeps them open.
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const open = (id: string) => setOpened((was) => new Set(was).add(id));

  // How many roots are mounted — see the header. Counted once per height
  // the page has had, as `useReach` does on a person's page: scroll
  // events come sixty a second and every one near the end is "near".
  const [shown, setShown] = useState(PAGE);
  const [countedAt, setCountedAt] = useState(-1);
  const onScroll: NonNullable<React.ComponentProps<typeof ScrollView>['onScroll']> = (e) => {
    const at = e.nativeEvent;
    if (!nearEnd(at) || countedAt === at.contentSize.height) return;
    setCountedAt(at.contentSize.height);
    setShown((n) => n + PAGE);
  };

  // The pull's own spinner: armed by the gesture, disarmed when the ask
  // settles, never lit by the ask the page makes on opening.
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && !thread.loading) setPulling(false);
  }, [pulling, thread.loading]);
  const pull = () => { setPulling(true); thread.reload(); };

  // The bar is away while this page is in front — see the header.
  useTabBarAway(navigation);
  // The home indicator's margin under the field, and none while the
  // keyboard is up — `useKeyboardUp`.
  const insets = useSafeAreaInsets();
  const typing = useKeyboardUp();
  const now = Date.now();
  const onPerson = (handle: string) => navigation.navigate('Person', { handle });
  const onPlace = (slug: string) => navigation.navigate('PlaceDetail', { slug });

  // Writing — see the header.
  const { session } = useSession();
  const { profile } = useProfile();
  const { askToSignIn } = useSaveActions();
  const { subject } = route.params;
  const me = session?.user?.id ?? null;
  const askIn = () => askToSignIn('comment');
  // Whom the next words answer, and sending them — `useThreadWriting`.
  const { replyTo, field, reply, send, cancelReply } = useThreadWriting(subject, me, askIn);
  // Whom and what "@" offers in the field — asked once, for a reader.
  const taggable = useTaggableQuery(subject, me);
  // Delete your own, report somebody else's — `useCommentMenu`.
  // Closed by its owner, or the owner's to close — `useThreadOwner`.
  const owner = useThreadOwner(subject, taggable.data, taggable.reload);
  const { menuOf, node: menuSheet } = useCommentMenu(me, taggable.data.mine);
  // A heart on each, drawn on the press — `useCommentHearts`.
  const { heartsOf, toggle } = useCommentHearts(me, thread.loadedAt, askIn);

  const branch = (b: Branch) => {
    const replies = opened.has(b.root.id) ? b.replies : b.replies.slice(0, REPLIES_SHOWN);
    const more = b.replies.length - replies.length;
    return (
      <View key={b.root.id} style={s.branch} testID="comment-branch">
        <CommentRow comment={b.root} when={agoLabel(b.root.created_at, now, lang, t)} onPerson={onPerson} onPlace={onPlace} onReply={() => reply(b.root)} replyOff={!!owner.closed} onMore={menuOf(b.root)} hearts={heartsOf(b.root)} onHeart={() => toggle(b.root)} />
        {replies.map((r) => (
          <CommentRow key={r.id} comment={r} when={agoLabel(r.created_at, now, lang, t)} onPerson={onPerson} onPlace={onPlace} onReply={() => reply(r)} replyOff={!!owner.closed} onMore={menuOf(r)} hearts={heartsOf(r)} onHeart={() => toggle(r)} />
        ))}
        {more > 0 ? (
          <PressableScale
            onPress={() => open(b.root.id)}
            haptic="selection"
            style={s.moreHang}
            contentStyle={s.more}
            accessibilityRole="button"
            testID="comment-more"
          >
            <View style={s.moreRule} />
            <Text style={s.moreText}>
              {more === 1
                ? t('View 1 more reply', 'Xem thêm 1 trả lời', '他1件の返信を表示', '查看另外 1 条回复', '檢視另外 1 條回覆')
                : t(`View ${more} more replies`, `Xem thêm ${more} trả lời`, `他${more}件の返信を表示`, `查看另外 ${more} 条回复`, `檢視另外 ${more} 條回覆`)}
            </Text>
          </PressableScale>
        ) : null}
      </View>
    );
  };

  const state = branches.length > 0 ? null : !thread.loaded || (thread.loading && thread.loadedAt === null) ? (
    <ActivityIndicator color={colors.accent} style={s.spinner} testID="comments-loading" />
  ) : thread.error ? (
    <EmptyState
      icon="cloud-offline"
      title={t("Couldn't load comments", 'Không tải được bình luận', 'コメントを読み込めませんでした', '无法加载评论', '無法載入評論')}
      body={t('Check your connection and try again.', 'Kiểm tra kết nối rồi thử lại.', '接続を確認して、もう一度お試しください。', '请检查网络连接后重试。', '請檢查網路連線後重試。')}
      testID="comments-failed"
    >
      <GradientCta
        icon="refresh"
        label={t('Try again', 'Thử lại', '再試行', '重试', '重試')}
        onPress={thread.reload}
        testID="comments-retry"
      />
    </EmptyState>
  ) : (
    <EmptyState
      icon="chatbubble-outline"
      title={t('No comments yet', 'Chưa có bình luận', 'まだコメントはありません', '还没有评论', '還沒有評論')}
      body={t(
        'What people say about this collection will show here.',
        'Những gì mọi người nói về bộ sưu tập này sẽ hiện ở đây.',
        'このコレクションへのコメントがここに表示されます。',
        '大家对这个合集的评论会显示在这里。', '大家對這個合集的評論會顯示在這裡。',
      )}
      testID="comments-empty"
    />
  );

  return (
    <Screen
      title={t('Comments', 'Bình luận', 'コメント', '评论', '評論')}
      onBack={() => navigation.goBack()}
      backTestID="comments-back"
      backBare
      compactTitle
      right={owner.right}
    >
      {/* The field rides up on the keyboard and the thread shortens
          above it. `padding` on iOS, where the keyboard overlays the
          window; Android resizes the window itself. */}
      <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={s.fill}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          // A press on "Reply" or a ⋯ lands while the keyboard is up,
          // rather than only putting it away.
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={pull} />}
          testID="comments-scroll"
        >
          {state}
          {branches.slice(0, shown).map(branch)}
        </ScrollView>
        <CommentComposer
          avatarUrl={profile?.avatar_url}
          replyTo={replyTo}
          onCancelReply={cancelReply}
          onSend={send}
          onGuest={me ? undefined : askIn}
          inputRef={field}
          taggable={taggable.data}
          closed={owner.closed}
          bottomInset={typing ? 0 : insets.bottom}
        />
      </KeyboardAvoidingView>
      {menuSheet}
    </Screen>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  // 16 under the last comment, so it does not sit on the field's rule.
  content: { paddingHorizontal: space.page, paddingBottom: 16 },
  spinner: { marginTop: 20 },
  // A hairline between one root's talk and the next, and the row's own 8
  // either side of it.
  branch: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderGlassSoft, paddingVertical: 4 },
  // The fold: under the answers, where an answer's words start. 44 tall to
  // the thumb.
  moreHang: { marginLeft: INDENT[1] },
  more: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  // Threads' and Instagram's short rule before the words: it reads as
  // "the line goes on" where a chevron would read as "go somewhere".
  moreRule: { width: 24, height: StyleSheet.hairlineWidth, backgroundColor: colors.textTertiary },
  moreText: { color: colors.textSecondary, fontSize: 14, fontWeight: font.semibold },
});
