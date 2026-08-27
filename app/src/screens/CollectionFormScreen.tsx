// Making one of your own lists, renaming it later — and saving a copy of
// somebody else's.
//
// One screen for all three: the fields are the same, only the verb
// changes. Two screens would be the same form twice, drifting apart the
// first time one of them gains a field. The copy is the odd one out only
// in when the row exists: rename edits a real row, create makes one on
// submit, and a copy is a row that does not exist yet being edited —
// prefilled from the source, born on save, and never born at all if the
// reader backs out.
//
// One required field. A collection is a name and, later, some places in
// it; asking for more up front is asking someone to fill a form before
// they have seen what the thing does. The description is there for people
// who want it and skipped by everyone else.
//
// The form pieces come from `authUi` — they were written for the auth
// screens but they are just a list-row field and a primary button, and the
// alternative is a second set that drifts from the first.

import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { AuthHeader, AuthScreen, ErrorText, FieldRow, Lede, PrimaryButton } from '../components/authUi';
import { PressableScale, successHaptic } from '../components/ui';
import { useAuth } from '../lib/auth';
import { usePlaces } from '../lib/catalog';
import { useCity } from '../lib/city';
import { addPlaceToCollection, copyCollection, createCollection, updateCollection } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { coverOf, membersOf, photosOf } from '../lib/place';
import { useSave } from '../lib/save';
import { colors, font, radius, space } from '../theme';
import type { Place } from '../lib/types';
import { goTo, type Nav, type RootRoute } from '../nav';

/** Long enough for a real name, short enough to stay on one line in a row. */
const MAX_TITLE = 60;

export default function CollectionFormScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'CollectionForm'>;
}) {
  const { t } = useI18n();
  const { session } = useAuth();
  const { city } = useCity();
  const { mine } = useSave();
  const editing = route.params?.slug;
  const addPlaceSlug = route.params?.addPlaceSlug;
  const copyFrom = route.params?.copyFrom;
  // A copy opens with its provenance already written in: "Copy of X" as
  // the title — a suggestion sitting in an editable field, not a suffix
  // welded on — and the source's description with the credit line the
  // detail screen composed. Truncated because the prefix can push a
  // long source title past what one row holds.
  const [title, setTitle] = useState(() => (copyFrom
    ? t(`Copy of ${copyFrom.title}`, `Bản sao của ${copyFrom.title}`, `「${copyFrom.title}」のコピー`).slice(0, MAX_TITLE)
    : route.params?.title ?? ''));
  const [desc, setDesc] = useState(copyFrom?.desc ?? route.params?.desc ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uid = session?.user?.id;

  // The cover, chosen from the photographs the list already holds. A
  // cover is a claim about the list, and the honest claims are the
  // pictures its own places carry — so the choices are exactly those, in
  // the list's own order, and a brand-new list (no places yet) offers no
  // picker at all. "Auto" is the null pick: the tile keeps falling back
  // to the first place's own cover, which is what every list did before
  // this row existed.
  const { data: places } = usePlaces();
  const col = editing ? mine.data.find((c) => c.slug === editing) ?? null : null;
  // A copy's members come from the route's slugs resolved against the
  // catalog — the source list belongs to somebody else, so no query of
  // "mine" can know it. Everything downstream (choices, Auto) is the
  // same either way.
  const members = copyFrom
    ? copyFrom.placeSlugs.map((slug) => places.find((p) => p.slug === slug)).filter((p): p is Place => !!p)
    : col ? membersOf(col, places) : [];
  const choices = members
    .flatMap((p) => photosOf(p))
    .filter((ph): ph is typeof ph & { id: string } => !!ph.id);
  // What "Auto" actually resolves to — the first place's own cover, the
  // exact fallback every renderer draws when nothing is picked. Shown on
  // the chip itself, so the current cover is always visible as a
  // picture rather than a word (the owner asked to see it).
  const autoUri = members[0] ? coverOf(members[0])?.photo_uri : undefined;
  // Held as "chosen or not" beside the id, so the row's current cover
  // shows as selected until the reader actually picks — seeding state
  // from a fetch that may land after the first render would either lose
  // their tap or resurrect the old cover over it.
  const [pick, setPick] = useState<{ chosen: boolean; id: string | null }>({ chosen: false, id: null });
  // A row hydrated from a launch cache written before the cover carried
  // its id arrives with only the uri — matched by uri then, so the ring
  // sits on the real current cover instead of drifting to Auto until
  // the refresh lands.
  const current = col?.cover ?? null;
  const coverId = pick.chosen
    ? pick.id
    : current
      ? current.id ?? choices.find((ph) => ph.photo_uri === current.photo_uri)?.id ?? null
      : null;

  const submit = async () => {
    const name = title.trim();
    if (!name) {
      setError(t('Give the collection a name.', 'Đặt tên cho bộ sưu tập.', 'コレクションに名前をつけてください。'));
      return;
    }
    // Both are true whenever the screen is reachable — it lives behind the
    // header control that only signed-in users see, and the city resolves
    // before any tab renders. Checked anyway so a failure is a sentence
    // rather than a crash.
    if (!uid || !city) {
      setError(t('Sign in first.', 'Hãy đăng nhập trước.', '先にサインインしてください。'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (copyFrom) {
        // The copy is born here, not when the menu row was tapped — this
        // form has been editing a list that did not exist, so backing out
        // at any point before this line left nothing behind.
        const slug = await copyCollection({
          ownerId: uid,
          cityId: copyFrom.cityId,
          title: name,
          desc,
          placeSlugs: copyFrom.placeSlugs,
        });
        // A chosen cover rides a second write: `copyCollection` stays the
        // create-and-fill it was, and Auto — the common case — needs no
        // write at all.
        if (coverId) await updateCollection(slug, { title: name, desc, coverPhotoId: coverId });
        successHaptic();
        mine.reload();
        // Pop the form off the stack it was pushed onto, so the tab it
        // came from keeps the source list as its history — then land on
        // the copy in the Collections tab, where Back leads to your own
        // lists. The copy is a thing you now own, not a thing you were
        // browsing.
        navigation.goBack();
        goTo('Collections', { screen: 'CollectionDetail', initial: false, params: { slug } });
        return;
      }
      if (editing) {
        await updateCollection(editing, { title: name, desc, coverPhotoId: coverId });
      } else {
        const slug = await createCollection({ ownerId: uid, cityId: city.id, title: name, desc });
        // Reached from a place's bookmark with nowhere to put it: the list
        // arrives holding the place that prompted it, rather than empty
        // with the save silently dropped on the way here.
        if (addPlaceSlug) await addPlaceToCollection(slug, addPlaceSlug, 0);
      }
      // Refresh the one shared copy before leaving. Without this the save
      // sheet keeps the list it fetched on launch, and a collection made
      // here never appears as somewhere to save to.
      mine.reload();
      // Back to the list, where the collection is now the first row of your
      // own section. Opening a new one instead would land on an empty screen.
      navigation.goBack();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      Alert.alert(
        copyFrom
          ? t('Could not save a copy', 'Không lưu được bản sao', 'コピーを保存できませんでした')
          : editing
            ? t('Could not save the changes', 'Không lưu được thay đổi', '変更を保存できませんでした')
            : t('Could not create the collection', 'Không tạo được bộ sưu tập', 'コレクションを作成できませんでした'),
        message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen>
      <AuthHeader
        onBack={() => navigation.goBack()}
        title={copyFrom
          ? t('Save a copy', 'Lưu bản sao', 'コピーを保存')
          : editing
            ? t('Rename your list', 'Đổi tên danh sách', 'リストの名前を変更')
            : t('Name your list', 'Đặt tên danh sách', 'リストに名前を')}
      />
      <Lede>{copyFrom
          ? t(
            'Make it yours before it saves — nothing is copied until you do.',
            'Sửa thoải mái trước khi lưu — chưa lưu thì chưa có bản sao nào cả.',
            '保存する前に自由に編集できます — 保存するまでコピーは作られません。',
          )
          : addPlaceSlug
            ? t(
              'Name it, and the place you just saved goes in first.',
              'Đặt tên, và địa điểm bạn vừa lưu sẽ vào đầu tiên.',
              '名前をつければ、いま保存したスポットが最初に入ります。',
            )
            : t(
              'Only you can see this one. Add places to it as you find them.',
              'Chỉ mình bạn thấy danh sách này. Thêm địa điểm vào khi bạn tìm được.',
              'このリストはあなただけに表示されます。見つけたスポットを追加していきましょう。',
            )}</Lede>
      <FieldRow
        icon="bookmark-outline"
        label={t('Name', 'Tên', '名前')}
        placeholder={t('Weekend coffee', 'Cà phê cuối tuần', '週末のコーヒー')}
        value={title}
        onChangeText={setTitle}
        maxLength={MAX_TITLE}
        autoFocus
        returnKeyType="next"
      />
      <FieldRow
        icon="text-outline"
        label={t('Description (optional)', 'Mô tả (không bắt buộc)', '説明（任意）')}
        placeholder={t('What ties these together?', 'Điều gì gắn kết những nơi này?', '共通点は何ですか？')}
        value={desc}
        onChangeText={setDesc}
        multiline
        returnKeyType="done"
      />
      {/* `choices` is only ever non-empty when there are members to draw
          from — a rename or a copy; a brand-new list offers no picker. */}
      {choices.length > 0 ? (
        <View style={s.coverBlock}>
          <Text style={s.coverLabel}>{t('COVER', 'ẢNH BÌA', 'カバー写真')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.coverRow}>
            <PressableScale
              onPress={() => setPick({ chosen: true, id: null })}
              accessibilityRole="button"
              accessibilityState={{ selected: coverId == null }}
              style={[s.thumb, s.auto, coverId == null && s.thumbOn]}
            >
              {/* The chip wears the picture Auto would use, so "what is
                  the cover right now" has a visible answer even before
                  anything is picked. A first place with no photograph
                  leaves the glass chip — nothing to preview. */}
              {autoUri ? (
                <>
                  <Image source={{ uri: autoUri }} style={s.thumbImg} contentFit="cover" transition={120} />
                  <View style={s.autoScrim}>
                    <Text style={s.autoOnPhoto}>{t('Auto', 'Tự động', '自動')}</Text>
                  </View>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles-outline" size={18} color={colors.textSecondary} />
                  <Text style={s.autoText}>{t('Auto', 'Tự động', '自動')}</Text>
                </>
              )}
            </PressableScale>
            {choices.map((ph) => (
              <PressableScale
                key={ph.id}
                onPress={() => setPick({ chosen: true, id: ph.id })}
                accessibilityRole="button"
                accessibilityState={{ selected: coverId === ph.id }}
                style={[s.thumb, coverId === ph.id && s.thumbOn]}
              >
                <Image source={{ uri: ph.photo_uri }} style={s.thumbImg} contentFit="cover" transition={120} />
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <View style={{ marginTop: space.cardGap }}>
        <PrimaryButton
          label={copyFrom
            ? t('Save the copy', 'Lưu bản sao', 'コピーを保存')
            : editing
              ? t('Save changes', 'Lưu thay đổi', '変更を保存')
              : t('Create collection', 'Tạo bộ sưu tập', 'コレクションを作成')}
          onPress={submit}
          busy={busy}
        />
      </View>
      {/* This line used to promise "sharing comes later", and later came:
          the publish switch lives in the list's own menu now. */}
      <Text style={{ color: colors.textTertiary, fontSize: 13.5, fontWeight: font.regular, textAlign: 'center', lineHeight: 19 }}>
        {t(
          'Private until you say so — Make public lives in the list’s own menu.',
          'Riêng tư cho đến khi bạn muốn — nút Công khai nằm trong menu của danh sách.',
          'あなたが公開するまで非公開です — 公開はリストのメニューから。',
        )}
      </Text>
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  coverBlock: { marginTop: space.cardGap },
  coverLabel: {
    color: colors.textTertiary, fontSize: 11, fontWeight: font.bold,
    letterSpacing: 1.1, marginBottom: 8,
  },
  coverRow: { gap: 10, paddingRight: space.page },
  // 2pt of always-there border so the chosen ring changes colour, not
  // layout — a thumb that grows on selection makes the whole row shuffle.
  thumb: {
    width: 64, height: 64, borderRadius: radius.card - 6,
    borderWidth: 2, borderColor: 'transparent', overflow: 'hidden',
  },
  thumbOn: { borderColor: colors.accentFill },
  thumbImg: { width: '100%', height: '100%' },
  auto: {
    alignItems: 'center', justifyContent: 'center', gap: 3,
    backgroundColor: colors.surfaceGlass,
  },
  autoText: { color: colors.textSecondary, fontSize: 10.5, fontWeight: font.medium },
  autoScrim: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(8,7,10,0.55)', paddingVertical: 3, alignItems: 'center',
  },
  autoOnPhoto: { color: '#F7F7F5', fontSize: 10, fontWeight: font.semibold },
});
