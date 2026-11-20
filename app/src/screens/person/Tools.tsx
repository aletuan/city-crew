// The header's right end on a person page (owner, 20 Nov 2026, from a
// mock-up of his own): search, then on your own page the bell and the
// gear.
//
// ── the gear is the way to Account ──
//
// Account had been reached by "Account ›" on the right of the activity
// heading (#1451, 19 Nov 2026), under the counts and the requests — a
// scroll away on a page with both. The gear is where Instagram and
// Threads keep the same door, the model the owner chose for this page
// (docs/profile-home-plan.md), and in sight the moment the page opens.
// The heading's link went the same day: two ways to one page from one
// screen is one too many.
//
// Its label is the tab's old name, "Account" / "Tài khoản", for the
// reason the link wore that word (owner, 19 Nov 2026). Three names for
// three things: "Trang cá nhân" is this page, "Tài khoản" the page of
// email, theme, language, sign out and delete, and "Sửa hồ sơ" the form
// for the name, the handle, the photograph and the bio — a button on
// Account, one press further.
//
// ── search, drawn and not built ──
//
// Disabled until it does something: the owner wanted its place known
// now. What it will search is open and written in the plan (§8): the
// person's own collections and the places in them, the answer
// `person/Shared` names for the grid it gave up — somebody's oldest list
// is the end of a feed. So it stands on everybody's page, not only your
// own: a visitor is who scrolls a stranger's 24 lists.
//
// ── spacing ──
//
// Three bare 44pt boxes edge to edge: the glyphs' centres 44 apart, as
// the mock-up has them, and every target still its full 44. The last is
// hung past the margin by its glyph's empty edge (`INK_GAP_END`), so the
// ink ends where the cover does, as the ⋯ does on somebody else's page.

import { StyleSheet, View } from 'react-native';
import { INK_GAP_END, RoundIconButton } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { Bell } from './Bell';

/** The search no one can use yet: dimmed, pressing nothing. */
export function SearchSoon() {
  const { t } = useI18n();
  return (
    <RoundIconButton
      bare
      disabled
      icon="search-outline"
      label={t('Search', 'Tìm kiếm', '検索', '搜索', '搜尋')}
      testID="person-search"
    />
  );
}

/** Your own page's end of the header: search, the bell, the gear. */
export function OwnTools({ onActivity, onAccount }: { onActivity: () => void; onAccount: () => void }) {
  const { t } = useI18n();
  return (
    <View style={s.row} testID="person-own-tools">
      <SearchSoon />
      <Bell onPress={onActivity} />
      <RoundIconButton
        bare
        style={s.hang}
        icon="settings-outline"
        onPress={onAccount}
        label={t('Account', 'Tài khoản', 'アカウント', '账号', '帳號')}
        testID="person-settings"
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  hang: { marginRight: -INK_GAP_END['settings-outline'] },
});
