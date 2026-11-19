// The head of the Account page: your picture in the level's ring, your
// name with the role's mark after it, your handle, and Edit profile.
//
// ── copied, not moved (owner, 19 Nov 2026) ──
//
// P3 of docs/profile-home-plan.md took all of this but the button off
// Account when it drew it on your own person page (`person/OwnFace`,
// `PersonRole`). The owner saw the page headed by a button alone and
// asked for it back the same day, on both pages: "copy, don't move".
//
// A file of its own because `AccountProfile` came off the oversize list
// that afternoon (`oversize.js`, #1463), and these lines would have put
// it back.

import { useMemo } from 'react';
import { Text, View } from 'react-native';
import AvatarPicker from '../../components/AvatarPicker';
import { PressableScale } from '../../components/ui';
import { useProfile, useSession } from '../../lib/auth';
import { savedPlaces } from '../../lib/badges';
import { useI18n } from '../../lib/i18n';
import { useMyLists } from '../../lib/save';
import { HeroFace } from './HeroFace';
import { HeroName } from './HeroName';
import { s } from './styles';

export function Hero({ onEdit }: { onEdit: () => void }) {
  const { t } = useI18n();
  const { email } = useSession();
  const { profile } = useProfile();
  const name = profile.full_name || (email ?? '').split('@')[0];
  // Distinct places, not rows: a place saved into two of your lists is
  // one place you have found, and counting it twice would turn the ring
  // into a measure of tidying rather than of exploring. `savedPlaces`
  // holds the sum, which the badges count by too.
  const mine = useMyLists();
  const saved = useMemo(() => savedPlaces(mine.data), [mine.data]);
  return (
    <View style={s.heroRow}>
      {/* No camera badge: Edit profile shows the same picker with its
          badge. Not the ring that answers the banner — your own page,
          under this one, does (`HeroFace`). */}
      <HeroFace saved={saved} size={88} answers={false}>
        <AvatarPicker showCamera={false} />
      </HeroFace>
      <View style={{ flex: 1, gap: 5 }}>
        <HeroName name={name} handle={profile.handle} />
        {/* Edit profile, by itself, under the name. Words only: it wore a
            pencil for a while, and the owner did not care for it — a
            glyph beside two words that already say "change" was one more
            thing to read. */}
        <View style={s.heroActions}>
          <PressableScale scaleTo={0.94} contentStyle={s.editBtn} onPress={onEdit} accessibilityRole="button">
            <Text style={s.editBtnText}>{t('Edit profile', 'Sửa hồ sơ', 'プロフィール編集', '编辑个人资料', '編輯個人資料')}</Text>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}
