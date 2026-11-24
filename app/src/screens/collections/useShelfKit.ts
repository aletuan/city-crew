// What the cards read of the screen (`ShelfKit`), and the state behind it
// that nothing else on the screen reads: the cover a tap opens from, the
// faces of the people who made the lists, the heart, the "New" mark, and
// who can see a list of yours.
//
// Out of CollectionsScreen since 24 Nov 2026. The lines were moved, not
// retyped.
import { useCallback, useEffect, useState } from 'react';
import { fireHaptic } from '../../components/ui';
import { useLikes } from '../../lib/catalog';
import { placesOf as placesCount } from '../../lib/collectionShelf';
import { type Collection, coverUriOf, fetchProfilesById, type FriendProfile, membersOf, type Place } from '../../lib/data';
import type { useI18n } from '../../lib/i18n';
import { useSaveActions } from '../../lib/save';
import { visibilityOf as seenOf } from '../../lib/shares';
import { useCoverOpen } from '../../lib/useCoverOpen';
import type { Nav } from '../../nav';
import type { ShelfKit } from './cards';

export function useShelfKit({ navigation, cols, shared, places, me, sharesOf, reasonFor, noteSearch, t }: {
  navigation: Nav;
  cols: { data: Collection[]; loadedAt: number | null };
  shared: { data: Collection[]; loadedAt: number | null };
  places: Place[];
  me: string | undefined;
  sharesOf: Record<string, unknown[]>;
  reasonFor: (slug: string) => string | null;
  noteSearch: () => void;
  t: ReturnType<typeof useI18n>['t'];
}): ShelfKit {
  const { askToSignIn } = useSaveActions();
  // One heart on every public list, yours included (owner, 17 Oct 2026):
  // a curator may like their own list, and the shelves rank on everyone's
  // likes but theirs (`rankLikes`, read by `useListRank`). It is the
  // control the Explore shelf taps, backed by the same provider, one copy
  // of the truth.
  const { likes, myLikes, toggleLike } = useLikes();

  // Read once a render: a list that turns eight days old while the tab is
  // open keeps its badge until the next one, which is soon enough.
  const now = Date.now();
  const newWord = t('New', 'Mới', '新着', '新', '新');

  const coverFor = (c: Collection) => coverUriOf(c, membersOf(c, places));
  const cover = useCoverOpen((slug, from) => navigation.navigate('CollectionDetail', from ? { slug, from } : { slug }));

  // The faces behind the community tiles, fetched once per catalog load
  // through the same batched lookup the Crew screen uses. A miss leaves
  // the Avatar drawing its placeholder circle — the seat is always
  // there, which is what keeps a bare handle reading as a signature
  // rather than a stray word. The Mosaic's cards wear it too since
  // 14 Nov 2026, when the `@` came off both.
  // The friends behind the lists shared with you are asked in the same
  // batch: their tiles wear the same byline.
  const [faces, setFaces] = useState<Record<string, FriendProfile>>({});
  useEffect(() => {
    const ids = [...new Set([...cols.data, ...shared.data].map((c) => c.owner_id).filter(Boolean))] as string[];
    if (!ids.length) return;
    fetchProfilesById(ids).then((more) => setFaces((prev) => ({ ...prev, ...more }))).catch(() => {});
  // Each `data` is a new array every load; `loadedAt` is the honest tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols.loadedAt, shared.loadedAt]);

  // The same wiring as the Explore shelf: signed out, the tap is the
  // sign-in invitation; signed in, the provider owns the write and the
  // optimistic count, so a like made here shows there.
  const onHeart = useCallback((c: Collection) => {
    if (!c.id) return;
    if (!me) { askToSignIn('like'); return; }
    fireHaptic('light');
    void toggleLike({ id: c.id, slug: c.slug });
  }, [me, toggleLike, askToSignIn]);

  const placesOf = (n: number) => placesCount(n, t);
  // Who can see a list of yours: Public, Friends or Private
  // (`lib/shares.visibilityOf`), from its flag and its shares.
  const seenFor = (c: { id?: string; is_public?: boolean | null }) =>
    seenOf(!!c.is_public, sharesOf[c.id ?? '']?.length ?? 0);
  // The same, in words, for VoiceOver: on screen the mark says it, and a
  // glyph is not read out.
  const visibilityOf = (c: { id?: string; is_public?: boolean | null }) => ({
    public: t('Public', 'Công khai', '公開', '公开', '公開'),
    friends: t('Friends', 'Bạn bè', '友達', '好友', '好友'),
    private: t('Private', 'Riêng tư', '非公開', '私密', '私密'),
  })[seenFor(c)];

  const kit: ShelfKit = {
    coverFor,
    open: (slug, uri) => { noteSearch(); cover.open(slug, uri); },
    coverRef: cover.ref,
    faces,
    now,
    newWord,
    membersOf: (c) => membersOf(c, places).length,
    reasonFor,
    myLikes,
    likes,
    onHeart,
    visibilityOf,
    seenFor,
    placesOf,
  };
  return kit;
}
