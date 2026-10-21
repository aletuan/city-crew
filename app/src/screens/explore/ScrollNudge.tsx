// The dock that offers search and suggest once browsing starts to look
// like hunting, and the suggest row at the foot of the list.

import { AddPill, AddSlot } from '../../components/add';
import { DockOffer, DockSlot } from '../../components/DockSlot';
import { useI18n } from '../../lib/i18n';

/**
 * The last row of the list, at the moment you have finished reading and
 * found the list short. Explore has nothing to name — you were browsing,
 * not looking for one thing — so it asks rather than offers.
 */
export function ExploreSuggestRow({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <AddSlot
      onPress={onPress}
      // "Thêm địa điểm mới", not "Biết chỗ nào chúng tôi còn thiếu?".
      // The question was 32 characters into a line that holds about 22
      // beside a 52pt circle and a chevron, so it arrived clipped —
      // "Biết chỗ nào chúng tôi còn thi…" — which is worse than blunt.
      //
      // `mới` is carrying real weight: a collection has its own "Thêm
      // địa điểm", and that one adds a place the catalog already has.
      // This one is for a place nobody has put there yet.
      title={t('Add a new place', 'Thêm địa điểm mới', '新しいスポットを追加', '添加新地点', '新增新地點')}
      // What you do, not what we do about it. "Chúng tôi lo phần còn lại"
      // was a promise about our end of the work, which is not the thing
      // standing between this row and the next screen. What you actually
      // need to know is what to type — and that an address works, which
      // is not obvious and is often all anyone has.
      subtitle={t('Search by name or address', 'Gõ tên quán hoặc địa chỉ để tìm kiếm', '店名や住所で検索', '按名称或地址搜索', '按名稱或地址搜尋')}
    />
  );
}

/**
 * The floating offer, once someone is clearly hunting rather than reading.
 *
 * Two things it must not do. It must not say the list is empty — it
 * plainly is not, there are cards under it — so it asks whether what you
 * want is here rather than announcing that it is not. And it must not
 * stay: it goes the moment the tab bar wants its place back.
 *
 * Its place is the tab bar's own dock. Scrolling deep is what hides the
 * bar, and scrolling deep is also what "hunting" looks like — so the slot
 * the bar vacates is empty at exactly the moment this offer is earned,
 * and in thumb reach besides. It wears the dock's geometry (the inset,
 * the island radius) so the slot reads as one place that changes content;
 * everything else about it — the text and the two actions —
 * looks nothing like five glyphs, so a hand reaching for a tab is never
 * fooled. The gate in lib/nudge.ts holds the sharing rules: the bar
 * always wins the slot back the same frame, and every time it leaves,
 * the offer takes the dock again — one barely-visible beat behind, so
 * the two never cross mid-dock.
 */
export function ScrollNudge({ visible, onSearch, onAdd }: {
  visible: boolean;
  onSearch: () => void;
  onAdd: () => void;
}) {
  const { t } = useI18n();
  // The dock's geometry, glass and arrival are `DockSlot`'s, and so is
  // the way the offer is set; what is Explore's is the words.
  return (
    <DockSlot visible={visible} onPress={onSearch} accessibilityRole="button">
      <DockOffer
        icon="search"
        title={t('Not finding it?', 'Chưa thấy chỗ cần tìm?', '見つかりませんか？', '没找到？', '沒找到？')}
        sub={t('Search, or add your own', 'Tìm nhanh hoặc tự thêm', '検索、または自分で追加', '搜索，或自己添加', '搜尋，或自己新增')}
      />
      {/* `tall`: the 44 every other control has — see `AddPill`. The
          word is the noun, "+ Địa điểm", the collection dock's word too
          (owner, 17 Oct 2026): the glyph says add, the word says what,
          and the screen's own title is the same noun. VoiceOver hears
          the whole verb phrase. */}
      <AddPill
        tall
        label={t('Place', 'Địa điểm', 'スポット', '地点', '地點')}
        accessibilityLabel={t('Add place', 'Thêm địa điểm', 'スポットを追加', '添加地点', '新增地點')}
        onPress={onAdd}
      />
    </DockSlot>
  );
}

// Per-city hero season — headline, CTA and the pinned cover place — comes
// from the city row itself, editable in the data desk's City hero screen.
// Every field is optional: cities keep the default framing, CTA and
// automatic photo pick until an editor overrides them.
