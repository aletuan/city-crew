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

import React, { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { AuthHeader, AuthScreen, FieldRow, FormError, useFailText } from '../components/authUi';
import { successHaptic } from '../components/ui';
import { useSession } from '../lib/auth';
import { useCollections } from '../lib/catalog';
import { useCurrentCity } from '../lib/city';
import { addPlaceToCollection, copyCollection, createCollection, updateCollection } from '../lib/data';
import { DAILY_CAPS, isDailyLimit } from '../lib/quota';
import { useI18n } from '../lib/i18n';
import { useMyLists } from '../lib/save';
import { useNoteEvent } from '../lib/tasteProfile';
import { goTo, type Nav, type RootRoute } from '../nav';
import { FieldRule, leaveForm, makingOwn, SaveHint, SeenLine, useAudience } from './collectionForm/formParts';

/** Long enough for a real name, short enough to stay on one line in a row. */
const MAX_TITLE = 60;

export default function CollectionFormScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'CollectionForm'>;
}) {
  const { t } = useI18n();
  const { session } = useSession();
  const { city } = useCurrentCity();
  const mine = useMyLists();
  const cols = useCollections();
  const editing = route.params?.slug;
  const addPlaceSlug = route.params?.addPlaceSlug;
  const copyFrom = route.params?.copyFrom;
  // A copy opens with its provenance already written in: "Copy of X" as
  // the title — a suggestion sitting in an editable field, not a suffix
  // welded on — and the source's description as the curator wrote it.
  // Where the copy came from is `copiedFrom`, saved onto the row, not a
  // line of text. Truncated because the prefix can push a long source
  // title past what one row holds.
  const [title, setTitle] = useState(() => (copyFrom
    ? t(`Copy of ${copyFrom.title}`, `Bản sao của ${copyFrom.title}`, `「${copyFrom.title}」のコピー`, `${copyFrom.title}（副本）`, `${copyFrom.title}（副本）`).slice(0, MAX_TITLE)
    : route.params?.title ?? ''));
  const [desc, setDesc] = useState(copyFrom?.desc ?? route.params?.desc ?? '');
  // What the form opened on, which `changed` measures against.
  const [start] = useState({ title, desc });
  const [busy, setBusy] = useState(false);
  const failText = useFailText();
  const [error, setError] = useState<string | null>(null);
  const note = useNoteEvent();

  const uid = session?.user?.id;

  // No cover here (owner, 22 Nov 2026): it is chosen from the camera on
  // the list's own page, so a new list and an old one share this form.
  const col = editing ? mine.data.find((c) => c.slug === editing) ?? null : null;
  // Who sees it, kept for Save like the fields (`formParts`).
  const aud = useAudience(col, uid, makingOwn(editing, copyFrom));

  // Whether the form now says something it did not say on opening — the
  // one question both the ✓ and the discard guard ask, so the two can
  // never disagree, as on the profile form.
  //
  // A rename's ✓ waits for it: lit on an untouched rename, it offered a
  // save that would write back exactly what was there. A new list and a
  // copy need only a name — the copy is born on submit, so submitting
  // its prefilled suggestion unchanged is the whole point of the button.
  // Who sees it counts since 20 Nov 2026 (`useAudience`).
  const changed = [title.trim() !== start.title.trim(), desc.trim() !== start.desc.trim(), aud.moved].includes(true);

  // Leaving with changes asks first — header Back and iOS's swipe alike,
  // both of which go through `beforeRemove`. A form that has just saved
  // leaves without asking: `saved` is set before each `goBack`.
  const saved = useRef(false);
  useEffect(() => {
    if (!changed) return undefined;
    return navigation.addListener('beforeRemove', (e) => {
      if (saved.current) return;
      e.preventDefault();
      Alert.alert(
        t('Discard your changes?', 'Bỏ các thay đổi?', '変更を破棄しますか？', '放弃更改？', '放棄更改？'),
        t(
          'What you changed on this list has not been saved.',
          'Những gì bạn vừa đổi trên bộ sưu tập này chưa được lưu.',
          'このリストの変更はまだ保存されていません。',
          '你对这个清单的更改尚未保存。', '你對這個清單的更改尚未儲存。',
        ),
        [
          { text: t('Keep editing', 'Tiếp tục sửa', '編集を続ける', '继续编辑', '繼續編輯'), style: 'cancel' },
          {
            text: t('Discard', 'Bỏ', '破棄', '放弃', '放棄'),
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
  }, [changed, navigation, t]);

  const submit = async () => {
    // Never empty: the header's button is dimmed until there is a name.
    const name = title.trim();
    // Both are true whenever the screen is reachable — it lives behind the
    // header control that only signed-in users see, and the city resolves
    // before any tab renders. Checked anyway so a failure is a sentence
    // rather than a crash.
    if (!uid || !city) {
      setError(t('Sign in first.', 'Hãy đăng nhập trước.', '先にサインインしてください。', '请先登录。', '請先登入。'));
      return;
    }
    setBusy(true);
    setError(null);
    // The list this save made, if it made one: where `leaveForm` goes.
    let made: Parameters<typeof leaveForm>[2] = null;
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
          // The row remembers its original, so the curator hears about
          // the copy the way they hear about a like (7 Oct 2026).
          copiedFrom: copyFrom.sourceId,
        });
        successHaptic();
        mine.reload();
        saved.current = true;
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
        await updateCollection(editing, { title: name, desc });
        made = aud.handOn(editing);
        // A public list is drawn from the catalog's copy too — the
        // Community tab, Explore's shelf, Ideas — and that copy refreshes
        // only on a pull or a stale foreground. A rename went unseen there
        // until one came (owner, 5 Nov 2026, of a cover; the cover is the
        // page's own save now). Only when public: a private list is not
        // in that copy, and refetching the whole catalog for it would
        // change nothing anyone sees. A copy needs none; it is private.
        if (col?.is_public) cols.reload();
      } else {
        made = { slug: await createCollection({ ownerId: uid, cityId: city.id, title: name, desc, isPublic: aud.seen === 'public' }), audience: aud.seen };
        // Reached from a place's bookmark with nowhere to put it: the list
        // arrives holding the place that prompted it, rather than empty
        // with the save silently dropped on the way here.
        if (addPlaceSlug) {
          await addPlaceToCollection(made.slug, addPlaceSlug, 0);
          // The first save an account ever makes comes through here — the
          // save sheet routes to this form precisely when there is no
          // list yet — and it went unrecorded while every later save was
          // noted by `lib/save`. The clearest statement of taste the
          // account will ever make, and the profile never heard it (#315).
          // After the add, so a failed insert records nothing.
          note(addPlaceSlug, 'save');
        }
      }
      // Refresh the one shared copy before leaving. Without this the save
      // sheet keeps the list it fetched on launch, and a collection made
      // here never appears as somewhere to save to.
      mine.reload();
      // Back to the list, where the collection is now the first row of your
      // own section. Opening a new one instead would land on an empty screen
      // — unless Friends was chosen, when it opens to choose them.
      leaveForm(navigation, saved, made, cols.reload);
    } catch (e) {
      // The daily cap — twenty lists, three hundred saves — is the one
      // refusal that is nobody's fault and nothing to fix; it gets its
      // own words, the way the suggest flow's `daily_limit` does.
      if (isDailyLimit(e)) {
        const words = t(
          `You can make ${DAILY_CAPS.collections} lists and save ${DAILY_CAPS.placesIntoLists} places a day. Come back tomorrow.`,
          `Mỗi ngày bạn có thể tạo ${DAILY_CAPS.collections} bộ sưu tập và lưu ${DAILY_CAPS.placesIntoLists} địa điểm. Mai quay lại nhé.`,
          `1日に${DAILY_CAPS.collections}件のリストと${DAILY_CAPS.placesIntoLists}件の保存ができます。また明日どうぞ。`,
          `你每天可以创建 ${DAILY_CAPS.collections} 个清单、保存 ${DAILY_CAPS.placesIntoLists} 个地点。明天再来吧。`, `你每天可以建立 ${DAILY_CAPS.collections} 個清單、儲存 ${DAILY_CAPS.placesIntoLists} 個地點。明天再來吧。`,
        );
        setError(words);
        Alert.alert(t('That is enough for today', 'Hôm nay vậy là đủ', '本日はここまで', '今天就到这里吧', '今天就到這裡吧'), words);
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      Alert.alert(
        copyFrom
          ? t('Could not save a copy', 'Không lưu được bản sao', 'コピーを保存できませんでした', '无法保存副本', '無法儲存副本')
          : editing
            ? t('Could not save the changes', 'Không lưu được thay đổi', '変更を保存できませんでした', '无法保存更改', '無法儲存更改')
            : t('Could not create the collection', 'Không tạo được bộ sưu tập', 'コレクションを作成できませんでした', '无法创建合集', '無法建立合集'),
        message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen>
      {/* Save in the header (`HeaderAction`): the cover grid below holds
          every photograph of every member, and with eleven of them the
          old full-width button sat under the fold. Lit once there is
          something to submit — see `changed`. */}
      <AuthHeader
        onBack={() => navigation.goBack()}
        // At 20, as the list's own page is (owner, 16 Nov 2026): the form
        // opened from a page titled at 20 and stood a size over it at 26
        // — see `type.titleCompact`, and `titles.test` for what holds it.
        backBare compactTitle
        title={copyFrom
          ? t('Save a copy', 'Lưu bản sao', 'コピーを保存', '保存副本', '儲存副本')
          : editing
            // Named for the thing the reader tapped "New" beside, in the
            // word the tab and every row of it use. "Name your list"
            // switched terms between the button and the form, and left a
            // new reader to work out whether a list was a collection
            // (UX-13, 17 Oct 2026). "Edit", not "Rename": the same form
            // changes the description, the chips and the cover too.
            ? t('Edit collection', 'Sửa bộ sưu tập', 'コレクションを編集', '编辑合集', '編輯合集')
            : t('New collection', 'Bộ sưu tập mới', '新しいコレクション', '新建合集', '新增合集')}
        action={{
          label: copyFrom
            ? t('Save the copy', 'Lưu bản sao', 'コピーを保存', '保存副本', '儲存副本')
            : editing
              ? t('Save changes', 'Lưu thay đổi', '変更を保存', '保存更改', '儲存更改')
              : t('Create collection', 'Tạo bộ sưu tập', 'コレクションを作成', '创建合集', '建立合集'),
          onPress: submit,
          busy,
          disabled: !title.trim() || (!!editing && !changed),
          testID: 'collection-submit',
        }}
      />
      {/* Beside the Save that raised it, rather than under the cover grid. */}
      {error ? <FormError>{failText(error)}</FormError> : null}
      {/* Who can see it, in a line that opens the plane's sheet (owner,
          16 and 20 Nov 2026): `SeenLine`. */}
      <SeenLine aud={aud} making={makingOwn(editing, copyFrom)} />
      <SaveHint kind={copyFrom ? 'copy' : addPlaceSlug ? 'place' : null} />
      {/* The fields on the page itself, between hairlines, with no box and
          no glyph (owner, 16 Nov 2026) — see `collectionForm/formParts`. */}
      <FieldRule />
      <FieldRow
        grouped
        flush
        // "Collection name", not "Name": with the glyph gone the label is
        // all that says what the line is, and it is the small half now.
        label={t('Collection name', 'Tên bộ sưu tập', 'コレクション名', '合集名称', '合集名稱')}
        placeholder={t('Weekend coffee', 'Cà phê cuối tuần', '週末のコーヒー', '周末咖啡', '週末咖啡')}
        value={title}
        onChangeText={setTitle}
        maxLength={MAX_TITLE}
        autoFocus
        testID="collection-name"
        returnKeyType="next"
      />
      {/* "Description", with no "(optional)" after it (removed at the
          owner's request, 10 Oct 2026). The form already says it: only
          the name stops a save, and the placeholder below is a question
          that can go unanswered. */}
      <FieldRule />
      <FieldRow
        grouped
        flush
        label={t('Description', 'Mô tả', '説明', '简介', '簡介')}
        placeholder={t('What ties these together?', 'Điều gì gắn kết những nơi này?', '共通点は何ですか？', '这些地点有什么共同点？', '這些地點有什麼共同點？')}
        value={desc}
        onChangeText={setDesc}
        multiline
        returnKeyType="done"
      />
      <FieldRule />
      {/* No chips here (owner, 16 Nov 2026). The list's kinds were shown
          between the description and the cover from 15 Oct, each a toggle
          that hid it from the list's page; they are worked out from the
          places now and the owner has no say — see `lib/collectionKinds`
          for the count that settled it. */}
    </AuthScreen>
  );
}

