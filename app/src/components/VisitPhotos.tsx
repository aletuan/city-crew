// The row of a visit's photos on the check-in sheet: what is there, what
// is going up, and a place to add one while there is room (K3 of
// `docs/checkin-photos-plan.md`; the state is `useVisitPhotos`).
//
// Tiles of 72 where they fit. Three photos and the add tile are 4 × 72 +
// 3 × 10 = 318 wide; a 375pt iPhone less the sheet's two margins of 22
// has 331. The first iPhone SE (320pt) still runs the iOS this app
// targets and has 276, so the tiles shrink to the width there is — 61 on
// that phone — rather than push the fourth off the sheet. A photo at 61
// is still a photo rather than an icon of one. Radius 12, the check-ins
// list's.
//
// A tile's ✕ is a 24 disc on its corner with its target widened to 44 by
// slop, the size the cover's camera disc settled at for something small
// over a picture (`PHOTO_DISC`'s reasoning, at the scale of a tile).
//
// A hidden photo — taken down by the desk — is drawn as a gap with the
// eye struck through: its owner should know it is gone and why the place
// is still taken, and may clear it.

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { useI18n } from '../lib/i18n';
import { colors, font, space } from '../theme';
import { PressableScale } from './ui';
import { Glyph, ICON } from './ui/glyph';
import type { Tile, VisitPhotos as Photos } from './useVisitPhotos';

export const TILE = 72;
const GAP = 10;
/** The side a tile gets on a screen `width` wide: 72, or less where four
 *  of them and their gaps do not fit between the sheet's margins. */
export const tileFor = (width: number) => Math.min(TILE, Math.floor((width - 2 * space.page - 3 * GAP) / 4));
const SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

export default function VisitPhotos({ photos }: { photos: Photos }) {
  const { t } = useI18n();
  const side = tileFor(useWindowDimensions().width);
  const box = { width: side, height: side };
  return (
    <View style={s.row} testID="visit-photos">
      {photos.tiles.map((tile, i) => <PhotoTile key={tile.key} tile={tile} n={i + 1} photos={photos} box={box} />)}
      {photos.room > 0 ? (
        <PressableScale
          onPress={() => { void photos.add(); }}
          scaleTo={0.95}
          haptic="selection"
          contentStyle={[s.tile, box, s.add]}
          accessibilityRole="button"
          accessibilityLabel={t('Add a photo', 'Thêm ảnh', '写真を追加', '添加照片', '新增照片')}
          testID="visit-photos-add"
        >
          <Glyph name="image-outline" size={ICON.action} color={colors.textSecondary} />
          <Text style={s.addText}>{t('Photo', 'Ảnh', '写真', '照片', '照片')}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

function PhotoTile({ tile, n, photos, box }: { tile: Tile; n: number; photos: Photos; box: { width: number; height: number } }) {
  const { t } = useI18n();
  const failed = tile.state === 'failed';
  const label = {
    done: t(`Photo ${n}`, `Ảnh ${n}`, `写真 ${n}`, `照片 ${n}`, `照片 ${n}`),
    sending: t(`Photo ${n}, uploading`, `Ảnh ${n}, đang tải lên`, `写真 ${n}、アップロード中`, `照片 ${n}，正在上传`, `照片 ${n}，正在上傳`),
    failed: t(`Photo ${n} did not upload. Try again`, `Ảnh ${n} chưa tải lên được. Thử lại`, `写真 ${n} をアップロードできませんでした。再試行`, `照片 ${n} 未能上传。重试`, `照片 ${n} 未能上傳。重試`),
    hidden: t(`Photo ${n} was hidden by City Crew`, `Ảnh ${n} đã bị City Crew ẩn`, `写真 ${n} は City Crew により非表示になりました`, `照片 ${n} 已被 City Crew 隐藏`, `照片 ${n} 已被 City Crew 隱藏`),
  }[tile.state];
  return (
    <View style={[s.tile, box]} testID={`visit-photo-${tile.state}`}>
      <PressableScale
        onPress={failed ? () => photos.retry(tile) : undefined}
        disabled={!failed}
        style={StyleSheet.absoluteFill}
        contentStyle={box}
        accessibilityRole={failed ? 'button' : 'image'}
        accessibilityLabel={label}
        testID="visit-photo"
      >
        {tile.uri ? <Image source={{ uri: tile.uri }} style={box} contentFit="cover" aria-hidden /> : null}
        {tile.state === 'sending' ? (
          <View style={s.over}><ActivityIndicator color={colors.text} /></View>
        ) : null}
        {failed ? (
          <View style={s.over}><Glyph name="refresh" size={ICON.action} color={colors.text} /></View>
        ) : null}
        {tile.state === 'hidden' ? (
          <View style={s.gap}><Glyph name="eye-off-outline" size={ICON.action} color={colors.textTertiary} /></View>
        ) : null}
      </PressableScale>
      {tile.state === 'sending' ? null : (
        <PressableScale
          onPress={() => photos.remove(tile)}
          scaleTo={0.85}
          hitSlop={SLOP}
          style={s.xAt}
          contentStyle={s.x}
          accessibilityRole="button"
          accessibilityLabel={t(`Remove photo ${n}`, `Bỏ ảnh ${n}`, `写真 ${n} を削除`, `删除照片 ${n}`, `刪除照片 ${n}`)}
          testID="visit-photo-remove"
        >
          <Glyph name="close" size={ICON.meta} color={colors.text} />
        </PressableScale>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: GAP },
  tile: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surfaceGlassStrong },
  add: {
    alignItems: 'center', justifyContent: 'center', gap: 2,
    backgroundColor: colors.surfaceGlass, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlass, borderStyle: 'dashed',
  },
  addText: { color: colors.textSecondary, fontSize: 12, fontWeight: font.medium },
  over: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,5,8,0.45)' },
  gap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  xAt: { position: 'absolute', top: 4, right: 4 },
  x: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,5,8,0.62)' },
});
