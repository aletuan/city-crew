// Profile's Preferences card: city, language, theme and tips.

import { useContext, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Card } from '../../components/ui';
import { useSignupTour } from '../../components/SignupTour';
import { CitySwitcherModal } from '../../components/CitySwitcher';
import { LanguageSwitcherModal } from '../../components/LanguageSwitcher';
import { schemeIcon, schemeLabel, ThemeSwitcherModal } from '../../components/ThemeSwitcher';
import { useCurrentCity } from '../../lib/city';
import { useI18n } from '../../lib/i18n';
import { useScheme } from '../../lib/theme';
import { SwitchRow, SettingRow } from './rows';
import { ProfileReturn } from './ProfileReturn';
import { s } from './styles';

/** Workspace settings, for guests and members alike: which city's
 *  catalog the app shows, which language it speaks, how it looks. The
 *  header carries no switchers — this card is the one place to change
 *  any of them. Its heading is written at each call site, beside the
 *  card, the way About me and Friends are.
 *
 *  The two public documents used to live at the bottom of this card,
 *  drawn without values to say they were not settings. They are their
 *  own card now: a reader looking for the terms was looking under a
 *  heading that said the app's behaviour was in there, and a drawing
 *  convention is a weaker signal than a heading. See `AppCard`. */
export function SettingsCard() {
  const { t, lang } = useI18n();
  const { city } = useCurrentCity();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  // Open from the first frame when this launch is the restart a theme
  // cost and the sheet was up when it was chosen — see `ProfileReturn`.
  //
  // Read once and then spent. This card is rendered by both of the
  // screen's personas, so signing in or out replaces it with a fresh
  // one, and a fresh one read the same answer: for the rest of the run
  // after a theme's restart, every sign-in and sign-out reopened the
  // Theme sheet on its own (the owner's "pops up by itself", 12 Oct
  // 2026). The record is for the launch's first frame and nothing after
  // it, so the first card to read it spends it. Spent in an effect
  // rather than in the initialiser, so a second initialiser call could
  // not find it already gone.
  const back = useContext(ProfileReturn);
  const [themeOpen, setThemeOpen] = useState(back.sheet === 'theme');
  useEffect(() => { if (back.sheet) back.spendSheet(); }, [back]);
  const { scheme, pref } = useScheme();
  const langLabel = { en: 'English', vi: 'Tiếng Việt', ja: '日本語', zh: '简体中文' }[lang];
  const tour = useSignupTour();
  // The invitation the switch raises floats over the page, above the tab
  // bar; with the card low on the screen it would cover the switch itself
  // (owner, 19 Oct 2026). Once it knows where its top is, the page scrolls
  // just enough to keep the switch above it, and not at all when it is.
  const guideRow = useRef<View>(null);
  const { notice, noticeTop } = tour;
  const { scrollBy } = back;
  useEffect(() => {
    if (notice !== 'ready' || noticeTop === null) return;
    guideRow.current?.measureInWindow((_x, y, _w, h) => {
      const over = y + h + 12 - noticeTop;
      if (over > 0) scrollBy(over);
    });
  }, [notice, noticeTop, scrollBy]);

  return (
    <>
      <Card style={s.featureCard}>
        <SettingRow
          icon="location-outline"
          // "City" alone read as a fact about the reader, sitting one card
          // below "Hometown", which is one. This is the catalog the app is
          // showing — it changes when you travel, and the label now says so.
          label={t('Current city', 'Thành phố hiện tại', '現在の都市', '当前城市')}
          value={city ? t(city.short_en, city.short_vi, city.short_ja) : '…'}
          onPress={() => setOpen(true)}
        />
        <SettingRow
          icon="language-outline"
          label={t('Language', 'Ngôn ngữ', '言語', '语言')}
          value={langLabel ?? 'English'}
          onPress={() => setLangOpen(true)}
          testID="profile-language"
        />
        {/* The glyph follows the ground showing, the words follow the
            setting: on Auto the row reads "Automatic" beside whichever of
            the moon or the sun the phone has chosen. Saying "Dark" there
            would hide that the choice is the phone's. Coffee and Rose
            wear their own mark (`schemeIcon`). */}
        <SettingRow
          icon={schemeIcon(pref, scheme)}
          label={t('Theme', 'Giao diện', 'テーマ', '主题')}
          value={schemeLabel(pref, t)}
          onPress={() => setThemeOpen(true)}
          testID="profile-theme"
        />
        <SwitchRow
          icon="bulb-outline"
          label={t('Show guide', 'Hiện hướng dẫn', 'ガイドを表示', '显示新手引导')}
          value={tour.enabled}
          onChange={tour.setEnabled}
          testID="profile-tips"
          rowRef={guideRow}
          last={!tour.enabled}
        />
        {tour.enabled && <SettingRow
          icon="refresh-outline"
          label={t('Replay guide', 'Xem lại hướng dẫn', 'ガイドをもう一度見る', '重新播放新手引导')}
          onPress={tour.replay}
          testID="profile-replay-guide"
          last
        />}
      </Card>
      <CitySwitcherModal visible={open} onClose={() => setOpen(false)} />
      <LanguageSwitcherModal visible={langOpen} onClose={() => setLangOpen(false)} />
      <ThemeSwitcherModal
        visible={themeOpen}
        onClose={() => setThemeOpen(false)}
        // Asked at the moment of the choice: this tab, this sheet, and how
        // far down the page is right then.
        returnTo={() => ({ tab: 'Profile', sheet: 'theme', y: back.y.current })}
      />
    </>
  );
}
