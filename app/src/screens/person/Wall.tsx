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
// The page itself is the preview (owner, 21 Nov 2026): a tap on a tile
// puts that picture on the cover above the sheet at once, with "Trying
// it" in its corner; Save keeps it, and closing without saving puts the
// cover back as it was. A preview inside the sheet was a second, smaller
// copy of what the page could show at its real size, under its real name
// and face, and it cost the sheet the room its last two rows needed —
// on a phone the uploads row sat under the Save button, unseen. So the
// sheet stands lower than the cover (`SHEET_MAX`), its scrim leaves the
// page undimmed, and the tiles are squares: their proportions matter less
// than seeing three rows at once, since the cover shows the real crop.
// Automatic is the first tile of the first row, not a line of its own.
// A row a source, scrolling sideways, the last tile half off the edge.
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
import { GradientCta, PressableScale } from '../../components/ui';
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
import { colors, display, font, space } from '../../theme';

/** A tile: square, three and a half across a 390pt sheet less its
 *  margins, so the fourth shows half of itself. Three rows of these,
 *  their labels and Save come to about 470pt — under `SHEET_MAX` on a
 *  6.1-inch phone (844pt), with the cover still in sight above. */
const TILE = 92;
/** The sheet stops short of the cover: the head of the page — header,
 *  170pt cover, name — ends about 330pt down; 60% of 844 leaves 338. */
const SHEET_MAX = '60%';

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
  // What the sheet has the cover try on: undefined is nothing, the cover
  // as saved. Kept after a save until the page has read itself again and
  // says the same, so the cover does not flick back in between.
  const [look, setLook] = useState<Wall | null | undefined>(undefined);
  useEffect(() => { if (!sheet && look !== undefined && sameWall(look, wall)) setLook(undefined); }, [sheet, look, wall]);
  const heroPhotos = useHeroPhotos(cities, sheet || wall?.kind === 'city');
  const auto = autoWall(open, coverFor, cityCoverUri(city, places));
  const shown = look === undefined ? wall : look;
  const cover = resolveWall(shown, { cities, heroPhotos, open, coverFor, auto });
  const edit = () => setSheet(true);
  const close = () => { setSheet(false); setLook(undefined); };
  return {
    cover,
    /** The sheet is open on a cover that is not the saved one. */
    trying: sheet && look !== undefined && !sameWall(look, wall),
    /** The cover's own press: a door on your own page, nothing elsewhere. */
    onCover: own ? edit : undefined,
    sheet: own ? (
      <WallSheet
        visible={sheet}
        onClose={close}
        current={wall}
        chosen={look === undefined ? wall : look}
        onPick={setLook}
        cities={cities}
        heroPhotos={heroPhotos}
        open={open}
        coverFor={coverFor}
        onSaved={() => { setSheet(false); reload(); }}
        onUploaded={() => { setSheet(false); setLook(undefined); reload(); }}
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

function WallSheet({ visible, onClose, current, chosen, onPick, cities, heroPhotos, open, coverFor, onSaved, onUploaded }: {
  visible: boolean;
  onClose: () => void;
  current: Wall | null;
  chosen: Wall | null;
  onPick: (w: Wall | null) => void;
  cities: readonly { id: string; short_en: string; short_vi: string; short_ja: string | null; hero_photo_uri?: string | null; hero_place_slug?: string | null }[];
  heroPhotos: Readonly<Record<string, PlacePhoto[]>>;
  open: readonly Collection[];
  coverFor: (c: Collection) => string | undefined;
  onSaved: () => void;
  onUploaded: () => void;
}) {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { updateProfile, setWallPhoto } = useAuthActions();
  const failText = useFailText();
  const [busy, setBusy] = useState(false);

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
      onUploaded();
    } catch (e) {
      Alert.alert(failText(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

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

        <ScrollView style={s.body} contentContainerStyle={s.bodyIn} showsVerticalScrollIndicator={false}>
          <Row label={t('Cities', 'Thành phố', '都市', '城市', '城市')} tiles={cityRow} chosen={chosen} onPick={onPick} testID="wall-cities">
            {/* Automatic leads the first row: the cover as the page would
                choose it, which is where everybody starts. */}
            <PressableScale
              onPress={() => onPick(null)}
              accessibilityRole="button"
              accessibilityLabel={t('Automatic: follows your newest collection', 'Tự động: theo bộ sưu tập mới nhất của bạn', '自動：最新のコレクションに合わせる', '自动：跟随你最新的收藏集', '自動：跟隨你最新的收藏集')}
              aria-selected={chosen === null}
              contentStyle={[s.tile, s.blank, chosen === null && s.on]}
              testID="wall-auto"
            >
              <Glyph name="refresh" size={ICON.text} color={colors.textSecondary} />
              <Text style={s.blankText}>{t('Automatic', 'Tự động', '自動', '自动', '自動')}</Text>
            </PressableScale>
          </Row>
          {listRow.length
            ? <Row label={t('Your collections', 'Bộ sưu tập của bạn', 'あなたのコレクション', '你的收藏集', '你的收藏集')} tiles={listRow} chosen={chosen} onPick={onPick} testID="wall-lists" />
            : null}

          <Text style={s.label}>{t('Your photo', 'Ảnh của bạn', 'あなたの写真', '你的照片', '你的照片')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.row} contentContainerStyle={s.rowIn} testID="wall-mine">
            <PressableScale onPress={upload} disabled={busy} accessibilityRole="button"
              accessibilityLabel={t('Upload a photo', 'Tải ảnh lên', '写真をアップロード', '上传照片', '上傳照片')}
              contentStyle={[s.tile, s.blank, s.add]} testID="wall-upload">
              <Glyph name="cloud-upload-outline" size={ICON.text} color={colors.text} />
              <Text style={s.blankText}>{t('Upload', 'Tải ảnh lên', 'アップロード', '上传', '上傳')}</Text>
            </PressableScale>
            {mine.map((tile) => (
              <Tile key="upload" tile={tile} on={sameWall(tile.wall, chosen)} onPick={onPick} />
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
function Row({ label, tiles, chosen, onPick, testID, children }: {
  label: string;
  tiles: readonly WallTile[];
  chosen: Wall | null;
  onPick: (w: Wall) => void;
  testID: string;
  /** Tiles of its own before the pictures — automatic, on the first. */
  children?: React.ReactNode;
}) {
  return (
    <>
      <Text style={s.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.row} contentContainerStyle={s.rowIn} testID={testID}>
        {children}
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
  // Clear: the page behind is the preview, and a scrim would grey out the
  // one thing the sheet is for. Still a press, so a tap above the sheet
  // closes it, as everywhere else.
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: SHEET_MAX,
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
  body: { flexGrow: 0 },
  bodyIn: { paddingBottom: 8 },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: font.medium, marginTop: 16, marginBottom: 8 },
  // Bled to the sheet's edges, so the last tile is cut by the phone, not
  // by the margin.
  row: { marginHorizontal: -space.page },
  rowIn: { paddingHorizontal: space.page, gap: 8 },
  tile: { width: TILE, height: TILE, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surfaceGlass },
  // A tile with a word instead of a picture: automatic, and the upload.
  blank: { alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4 },
  blankText: { color: colors.text, fontSize: 12, fontWeight: font.medium, textAlign: 'center' },
  on: { borderColor: colors.accent },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.35)' },
  tileText: { color: '#fff', fontSize: 12, fontWeight: font.medium },
  add: { borderStyle: 'dashed', borderColor: colors.borderGlass },
  note: { color: colors.textTertiary, fontSize: 12, marginTop: 6 },
  commit: { marginTop: 12 },
});
