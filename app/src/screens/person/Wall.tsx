// The cover across the top of a person's page, and on your own the sheet
// that changes it — docs/wall-plan.md (owner, 21 Nov 2026).
//
// ── what the page shows ──
//
// The owner's choice (`profiles.wall_kind`/`wall_ref`), resolved by
// `lib/wall` against what the page already holds: every city, and this
// person's public lists. Nothing chosen is automatic — the newest public
// list's cover *after the first*, else the city's — because the first is
// the first card under the cover, and the same pastries twice, one above
// the other, is what the owner saw on his phone and why this exists.
//
// ── the sheet ──
//
// A preview at the top at the cover's own proportions, with the face over
// its corner as the page has it, then one row a source, each scrolling
// sideways (owner, 21 Nov 2026): a grid two across put fifteen lists in
// eight rows and pushed everything under them off the sheet, and squeezed
// a tile to 170pt across for a picture that is 2.4 times wider than high.
// A row keeps every source in sight, and the last tile half off the edge
// says there is more without a word. A tap is a look, the preview follows
// it; Save commits, as the avatar's animals do, because a row is browsed.
//
// Opened by the camera in the header's row and by the cover itself; on
// somebody else's page neither is there.
//
// ── the upload ──
//
// One photograph at a time, from the library (owner, 21 Nov 2026): stored
// at `<uid>/wall.jpg` beside the face, overwritten by the next, and shown
// back as a tile while it is the one worn. Anyone can report a profile and
// the desk can take a cover down (`moderate_profile`'s `clear_wall`).

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyph, ICON } from '../../components/ui/glyph';
import { GradientCta, PressableScale, SECONDARY_CONTROL_H } from '../../components/ui';
import { useFailText } from '../../components/authUi';
import { useAuthActions } from '../../lib/auth';
import { useCityList, useCurrentCity } from '../../lib/city';
import { cityCoverUri, type Collection, fetchPlacePhotos, type FriendProfile, type Place } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { localized } from '../../lib/localized';
import type { PlacePhoto } from '../../lib/types';
import {
  autoWall, cityTiles, collectionTiles, heroSlugsWanted, resolveWall, sameWall, type Wall, wallColumns, wallOf, type WallTile,
} from '../../lib/wall';
import { colors, display, font, radius, space } from '../../theme';

/** A tile's width in a row: about two and a half across a 390pt sheet,
 *  so the third shows half of itself. */
const TILE_W = 140;
/** The cover's proportions: 2.4 to 1, the page's 170pt cover on a phone
 *  about 410pt wide less its margins. */
const RATIO = 2.4;

/**
 * The page's cover, and on your own page the means to change it.
 *
 * The hero photographs of the cities that have none of their own are
 * fetched only when something needs them: a city chosen as this cover,
 * or the sheet open.
 */
export function useWall({ person, own, open, coverFor, places, reload }: {
  person: FriendProfile | null;
  own: boolean;
  open: readonly Collection[];
  coverFor: (c: Collection) => string | undefined;
  places: readonly Place[];
  reload: () => void;
}) {
  const { city } = useCurrentCity();
  const { cities } = useCityList();
  const [sheet, setSheet] = useState(false);
  const wall = wallOf(person);
  const heroPhotos = useHeroPhotos(cities, sheet || wall?.kind === 'city');
  const auto = autoWall(open, coverFor, cityCoverUri(city, places));
  const cover = resolveWall(wall, { cities, heroPhotos, open, coverFor, auto });
  const edit = () => setSheet(true);
  return {
    cover,
    /** The sheet's door, for the header's camera — drawn on your own page
     *  only, so always there for it. */
    edit,
    /** The cover's own press: a door on your own page, nothing elsewhere. */
    onCover: own ? edit : undefined,
    sheet: own ? (
      <WallSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        current={wall}
        auto={auto}
        cities={cities}
        heroPhotos={heroPhotos}
        open={open}
        coverFor={coverFor}
        face={person?.avatar_url}
        onSaved={() => { setSheet(false); reload(); }}
      />
    ) : null,
  };
}

/** Hero places' photographs, by slug, for the cities without a photograph
 *  of their own — once, when first wanted. A failure leaves those cities
 *  out of the row and a chosen one on automatic; neither is worth a word. */
function useHeroPhotos(cities: readonly { id: string; hero_photo_uri?: string | null; hero_place_slug?: string | null }[], wanted: boolean) {
  const [photos, setPhotos] = useState<Record<string, PlacePhoto[]>>({});
  const slugs = heroSlugsWanted(cities).join(',');
  const [asked, setAsked] = useState('');
  useEffect(() => {
    if (!wanted || !slugs || asked === slugs) return;
    setAsked(slugs);
    fetchPlacePhotos(slugs.split(',')).then(setPhotos, () => {});
  }, [wanted, slugs, asked]);
  return photos;
}

function WallSheet({ visible, onClose, current, auto, cities, heroPhotos, open, coverFor, face, onSaved }: {
  visible: boolean;
  onClose: () => void;
  current: Wall | null;
  auto: string | undefined;
  cities: readonly { id: string; short_en: string; short_vi: string; short_ja: string | null; hero_photo_uri?: string | null; hero_place_slug?: string | null }[];
  heroPhotos: Readonly<Record<string, PlacePhoto[]>>;
  open: readonly Collection[];
  coverFor: (c: Collection) => string | undefined;
  face: string | undefined;
  onSaved: () => void;
}) {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { updateProfile, setWallPhoto } = useAuthActions();
  const failText = useFailText();
  const [chosen, setChosen] = useState<Wall | null>(current);
  const [busy, setBusy] = useState(false);
  // Opening again starts from what is worn, not from the last look.
  useEffect(() => { if (visible) setChosen(current); }, [visible, current]);

  const cityRow = useMemo(
    () => cityTiles(cities.map((c) => ({ ...c, name: t(c.short_en, c.short_vi, c.short_ja ?? undefined) })), heroPhotos),
    [cities, heroPhotos, t],
  );
  const listRow = collectionTiles(open, coverFor, (c) => localized(c, 'title', lang));
  // The one upload there can be, offered back while it is the one worn;
  // once another cover is saved nothing names it, and it is not offered.
  const mine: WallTile[] = current?.kind === 'upload'
    ? [{ wall: current, uri: current.ref, title: t('Your photo', 'Ảnh của bạn', 'あなたの写真', '你的照片', '你的照片') }]
    : [];

  // A photograph commits at once, as the avatar's does: opening the
  // library was already the decision, and the upload is the slow part a
  // second press would only delay. No crop: the library's editor crops
  // square on iOS whatever aspect is asked, and a square cut of a
  // 2.4-to-1 cover is the wrong frame — the cover fills by its centre.
  const upload = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    setBusy(true);
    try {
      await setWallPhoto(res.assets[0].uri);
      onSaved();
    } catch (e) {
      Alert.alert(failText(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };
  const preview = resolveWall(chosen, { cities, heroPhotos, open, coverFor, auto });

  const save = async () => {
    setBusy(true);
    try {
      await updateProfile(wallColumns(chosen));
      onSaved();
    } catch {
      Alert.alert(t('Couldn\'t save the cover. Try again.', 'Chưa lưu được ảnh bìa. Thử lại nhé.', 'カバーを保存できませんでした。もう一度お試しください。', '未能保存封面，请重试。', '未能儲存封面，請重試。'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]} testID="wall-sheet">
        <View style={s.grabber} />
        <View style={s.head}>
          <Text style={s.title}>{t('Cover', 'Ảnh bìa', 'カバー', '封面', '封面')}</Text>
          <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel={t('Close', 'Đóng', '閉じる', '关闭', '關閉')}
            hitSlop={8} style={s.close} contentStyle={s.closeFace} testID="wall-close">
            <Glyph name="close" size={ICON.nav} color={colors.textSecondary} />
          </PressableScale>
        </View>

        {/* The cover as the page will wear it, the face over its corner. */}
        <View style={s.preview} testID="wall-preview">
          {preview
            ? <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
            : <View style={[StyleSheet.absoluteFill, s.tint]} />}
          {face ? <Image source={{ uri: face }} style={s.face} contentFit="cover" accessible={false} /> : null}
        </View>

        <ScrollView style={s.body} contentContainerStyle={s.bodyIn} showsVerticalScrollIndicator={false}>
          <Text style={s.label}>{t('Automatic', 'Tự động', '自動', '自动', '自動')}</Text>
          <PressableScale
            onPress={() => setChosen(null)}
            accessibilityRole="button"
            aria-selected={chosen === null}
            contentStyle={[s.autoRow, chosen === null && s.on]}
            testID="wall-auto"
          >
            <Glyph name="refresh" size={ICON.text} color={colors.textSecondary} />
            <Text style={s.autoText}>{t('Follows your newest collection', 'Theo bộ sưu tập mới nhất của bạn', '最新のコレクションに合わせる', '跟随你最新的收藏集', '跟隨你最新的收藏集')}</Text>
            {chosen === null ? <Glyph name="checkmark" size={ICON.text} color={colors.accent} /> : null}
          </PressableScale>

          <Row label={t('Cities', 'Thành phố', '都市', '城市', '城市')} tiles={cityRow} chosen={chosen} onPick={setChosen} testID="wall-cities" />
          {listRow.length
            ? <Row label={t('Your collections', 'Bộ sưu tập của bạn', 'あなたのコレクション', '你的收藏集', '你的收藏集')} tiles={listRow} chosen={chosen} onPick={setChosen} testID="wall-lists" />
            : null}

          <Text style={s.label}>{t('Your photo', 'Ảnh của bạn', 'あなたの写真', '你的照片', '你的照片')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.row} contentContainerStyle={s.rowIn} testID="wall-mine">
            <PressableScale onPress={upload} disabled={busy} accessibilityRole="button"
              accessibilityLabel={t('Upload a photo', 'Tải ảnh lên', '写真をアップロード', '上传照片', '上傳照片')}
              contentStyle={[s.tile, s.add]} testID="wall-upload">
              <Glyph name="cloud-upload-outline" size={ICON.text} color={colors.text} />
              <Text style={s.addText}>{t('Upload', 'Tải ảnh lên', 'アップロード', '上传', '上傳')}</Text>
            </PressableScale>
            {mine.map((tile) => (
              <Tile key="upload" tile={tile} on={sameWall(tile.wall, chosen)} onPick={setChosen} />
            ))}
          </ScrollView>
          <Text style={s.note}>{t('One photo. A new one replaces it.', 'Một ảnh. Ảnh mới sẽ thay ảnh cũ.', '写真は1枚。新しい写真で置き換わります。', '仅一张。新照片会替换旧的。', '僅一張。新照片會替換舊的。')}</Text>
        </ScrollView>

        <View style={s.commit}>
          <GradientCta wide label={t('Save', 'Lưu', '保存', '保存', '儲存')} onPress={save}
            busy={busy} disabled={busy || sameWall(chosen, current)} testID="wall-save" />
        </View>
      </View>
    </Modal>
  );
}

/** One source: its name, then its pictures in a row that scrolls. */
function Row({ label, tiles, chosen, onPick, testID }: {
  label: string;
  tiles: readonly WallTile[];
  chosen: Wall | null;
  onPick: (w: Wall) => void;
  testID: string;
}) {
  return (
    <>
      <Text style={s.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.row} contentContainerStyle={s.rowIn} testID={testID}>
        {tiles.map((tile) => (
          <Tile key={`${tile.wall.kind}:${tile.wall.ref}`} tile={tile} on={sameWall(tile.wall, chosen)} onPick={onPick} />
        ))}
      </ScrollView>
    </>
  );
}

/** One picture to choose: a look, not yet a save. */
function Tile({ tile, on, onPick }: { tile: WallTile; on: boolean; onPick: (w: Wall) => void }) {
  return (
    <Pressable
      onPress={() => onPick(tile.wall)}
      accessibilityRole="button"
      accessibilityLabel={tile.title}
      aria-selected={on}
      testID={`wall-tile-${tile.wall.kind}${tile.wall.kind === 'upload' ? '' : `-${tile.wall.ref}`}`}
      style={[s.tile, on && s.on]}
    >
      <Image source={{ uri: tile.uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
      <View style={s.scrim}><Text style={s.tileText} numberOfLines={1}>{tile.title}</Text></View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%',
    paddingHorizontal: space.page, paddingTop: 10,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.textTertiary, marginBottom: 12 },
  head: { alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: colors.text, fontSize: 18, fontFamily: display.bold },
  close: { position: 'absolute', right: 0 },
  closeFace: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  preview: { aspectRatio: RATIO, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surfaceGlass },
  tint: { backgroundColor: colors.accentSoft },
  // A third of the preview's height, at the corner where the page's sits.
  // No ring: a dynamic colour on a border goes stale against the app's
  // appearance (`src/borders.test.ts`), and on a photograph none is needed.
  face: { position: 'absolute', left: 12, bottom: 10, width: 44, height: 44, borderRadius: 22 },
  body: { flexGrow: 0 },
  bodyIn: { paddingBottom: 8 },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: font.medium, marginTop: 16, marginBottom: 8 },
  // A row of the sheet, not a button: the card's radius, at the
  // secondary control's height.
  autoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, minHeight: SECONDARY_CONTROL_H,
    borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  autoText: { flex: 1, color: colors.text, fontSize: 15 },
  // Bled to the sheet's edges, so the last tile is cut by the phone, not
  // by the margin.
  row: { marginHorizontal: -space.page },
  rowIn: { paddingHorizontal: space.page, gap: 8 },
  tile: { width: TILE_W, aspectRatio: RATIO, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surfaceGlass },
  on: { borderColor: colors.accent },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.35)' },
  tileText: { color: '#fff', fontSize: 12, fontWeight: font.medium },
  add: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderStyle: 'dashed', borderColor: colors.borderGlass },
  addText: { color: colors.text, fontSize: 13, fontWeight: font.medium },
  note: { color: colors.textTertiary, fontSize: 12, marginTop: 6 },
  commit: { marginTop: 12 },
});
