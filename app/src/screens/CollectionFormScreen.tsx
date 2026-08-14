// Making one of your own lists, and renaming it later.
//
// One screen for both: the fields are the same, only the verb changes.
// Two screens would be the same form twice, drifting apart the first time
// one of them gains a field.
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
import { Alert, Text, View } from 'react-native';
import { AuthHeader, AuthScreen, ErrorText, FieldRow, Lede, PrimaryButton } from '../components/authUi';
import { useAuth } from '../lib/auth';
import { useCity } from '../lib/city';
import { addPlaceToCollection, createCollection, updateCollection } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { useSave } from '../lib/save';
import { colors, font, space } from '../theme';
import type { Nav, RootRoute } from '../nav';

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
  const [title, setTitle] = useState(route.params?.title ?? '');
  const [desc, setDesc] = useState(route.params?.desc ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uid = session?.user?.id;

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
      if (editing) {
        await updateCollection(editing, { title: name, desc });
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
        editing
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
        title={editing
          ? t('Rename your list', 'Đổi tên danh sách', 'リストの名前を変更')
          : t('Name your list', 'Đặt tên danh sách', 'リストに名前を')}
      />
      <Lede>{addPlaceSlug
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
      {error ? <ErrorText>{error}</ErrorText> : null}
      <View style={{ marginTop: space.cardGap }}>
        <PrimaryButton
          label={editing
            ? t('Save changes', 'Lưu thay đổi', '変更を保存')
            : t('Create collection', 'Tạo bộ sưu tập', 'コレクションを作成')}
          onPress={submit}
          busy={busy}
        />
      </View>
      <Text style={{ color: colors.textTertiary, fontSize: 13.5, fontWeight: font.regular, textAlign: 'center', lineHeight: 19 }}>
        {t(
          'Private for now — sharing your lists comes later.',
          'Hiện tại là riêng tư — chia sẻ danh sách sẽ có sau.',
          '今のところ非公開です — 共有機能は後日。',
        )}
      </Text>
    </AuthScreen>
  );
}
