// Out of `PlanEditScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.

import React, { useMemo } from 'react';
import { Animated, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Glyph, ICON } from '../../components/ui/glyph';
import { Card, GradientCta, Screen, fireHaptic } from '../../components/ui';
import LegRow from '../../components/LegRow';
import StopCard from '../../components/StopCard';
import { RailColumn } from '../../components/rail';
import type { useListDrag } from '../../components/useListDrag';
import { factLine, type freshen } from '../../lib/assist';
import { usePlacePhotos, withPhotos } from '../../lib/data';
import { clockOf, fmtVnd } from '../../lib/format';
import { fmtDistance } from '../../lib/geo';
import { useI18n } from '../../lib/i18n';
import {
  type legsOfPlan, move, nudge, outOfOrder, remove, windowOf, type Editable,
} from '../../lib/itinerary';
import { modeIcon, overallMode } from '../../lib/travel';
import { COMPANY } from '../../lib/trip';
import { spendVnd } from '../../lib/trips';
import type { Place } from '../../lib/types';
import { useFlag } from '../../lib/useFlag';
import type { Nav } from '../../nav';
import { colors } from '../../theme';
import { s } from './styles';

type Stops = Editable<Place>[];
type Legs = ReturnType<typeof legsOfPlan>;

/** One fact of the evening, worn as a chip under the title. Not a control:
 *  no role, no press — the glyph is the accent's because the reference
 *  colours it so, and because a grey glyph on a grey chip was the one
 *  thing on the page with no contrast of its own. */
function Fact({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={s.chip}>
      <Glyph name={icon as keyof typeof Ionicons.glyphMap} size={ICON.text} color={colors.accent} />
      <Text style={s.chipText}>{text}</Text>
    </View>
  );
}

/** The evening's facts, as chips under the title. */
export function Facts({ current, legs, companyKey }: { current: Stops; legs: Legs; companyKey: string | null }) {
  const { t } = useI18n();
  const [from, to] = windowOf(current);
  // The same sum a saved trip is priced by, so the figure here is the one
  // TripDetail will show for it.
  const spend = spendVnd(current.map((s) => s.place));
  // Behind the place detail's price switch (#598), like the options card
  // and the saved trip: a per-person sum of prices the reader cannot see.
  const showPrice = useFlag('place_price');
  // The evening's facts, for the chips under the title. Distance is the
  // legs summed — the figure the options card prints in its footer — and
  // it wears the glyph of how the whole route is made: a walk only when
  // every measured leg is one, as the map's directions decide it. Company
  // comes from the table the wizard's tiles read, so "Friends" here is the
  // tile the reader tapped there.
  const km = legs.reduce((n, l) => n + (l?.km ?? 0), 0);
  const company = COMPANY.find((c) => c.key === companyKey);
  return (
    <View style={s.chips}>
      {current.length > 0 && <Fact icon="time-outline" text={`${clockOf(from)}–${clockOf(to)}`} />}
      {km > 0 && (
        <Fact icon={modeIcon(overallMode(legs))} text={fmtDistance(km)} />
      )}
      {company && <Fact icon={company.icon} text={t(company.en, company.vi, company.ja, company.zh, company.hant)} />}
      {showPrice && spend > 0 && (
        <Fact icon="wallet-outline" text={`~${fmtVnd(spend)} / ${t('person', 'người', '人', '人', '人')}`} />
      )}
    </View>
  );
}

/** What the controls on the cards do, said once above them. */
export function Hint({ canArrange }: { canArrange: boolean }) {
  const { t } = useI18n();
  return (
    <View style={s.hint}>
      <Glyph name="move-outline" size={ICON.text} color={colors.textTertiary} />
      <Text style={s.hintText}>
        {canArrange
          ? t('Hold a stop to move it. Nudge its time with − and +.', 'Giữ một điểm để kéo đổi chỗ. Chỉnh giờ bằng − và +.', 'スポットを長押しして動かす。時刻は − と + で調整。', '长按地点即可移动。用 − 和 + 微调时间。', '長按地點即可移動。用 − 和 + 微調時間。')
          : t('Nudge the time with − and +.', 'Chỉnh giờ bằng − và +.', '時刻は − と + で調整。', '用 − 和 + 微调时间。', '用 − 和 + 微調時間。')}
      </Text>
    </View>
  );
}

/** The stops, each with the leg out of it, on the rail. */
export function StopRows({ current, legs, live, tz, canArrange, drag, setStops, navigation }: {
  current: Stops;
  legs: Legs;
  live: ReturnType<typeof freshen>;
  tz: string;
  canArrange: boolean;
  drag: Pick<ReturnType<typeof useListDrag>, 'styleOf' | 'onPitch' | 'onLift' | 'onRelease'>;
  setStops: (next: Stops) => void;
  navigation: Nav;
}) {
  const { t } = useI18n();
  const { styleOf, onPitch, onLift, onRelease } = drag;
  // The planner plans over the catalog, which carries one photograph a
  // place; the stop cards page through them all, so the rest are asked for
  // here. By name in a fixed order, so dragging a stop is not a new question.
  const stopPhotos = usePlacePhotos(current.length ? current.map((st) => st.place.slug).sort() : null);
  // Taken once, on the way in. `openState` needs an instant, and a fresh
  // `new Date()` per render would make every fact line a new object and
  // re-open the question of whether a café is open on every keystroke.
  const now = useMemo(() => new Date(), []);
  const wrong = useMemo(() => outOfOrder(current), [current]);
  return (
    <>
      {current.map((stop, i) => {
        return (
        // The row the drag lifts: the card and the leg out of it, so a
        // stop travels with its journey and the rows it passes step
        // aside by the pair's height, which is what `onPitch` reports.
        <Animated.View
          key={stop.place.slug}
          style={styleOf(i)}
          onLayout={(e) => onPitch(stop.place.slug, e.nativeEvent.layout.height)}
          testID={`drag-${stop.place.slug}`}
        >
          {/* The rail beside the card — `components/rail`, the one the
              options card and the saved trip draw. The column stretches
              to the row, so the line reaches the next mark across the
              card and the leg under it; the last stop ends the line,
              since a line running on past the evening's end points at
              nothing. */}
          <View style={s.stopRow}>
            <RailColumn first={i === 0} last={i === current.length - 1} />
            <View style={[s.column, i < current.length - 1 && s.columnGap]}>
          <StopCard
            place={withPhotos(stop.place, stopPhotos.data[stop.place.slug])}
            arriveMin={stop.arriveMin}
            dwellMin={stop.dwellMin}
            pinned={stop.pinned}
            // A sentence if one was written, and the facts behind it if
            // not. Never nothing, and never a spinner: the plan is
            // complete before the words arrive — and since the options
            // screen started asking ahead, they normally arrived before
            // this screen did. The rating is left out of the fallback —
            // `factLine` would happily print it, but the card sets it
            // beside the name, and a line that repeats the header one
            // row down reads as a screen stuttering.
            why={live.why.get(stop.place.slug)
              || factLine({
                slug: stop.place.slug,
                name: stop.place.name_en,
                rating: null,
                openingHours: stop.place.opening_hours,
                arriveMin: stop.arriveMin,
              }, now, tz, t)}
            wrong={wrong.includes(i)}
            canMoveUp={canArrange && i > 0}
            canMoveDown={canArrange && i < current.length - 1}
            onOpen={() => navigation.navigate('PlaceDetail', { slug: stop.place.slug })}
            onHold={canArrange ? (pageY) => onLift(i, pageY) : undefined}
            onRelease={onRelease}
            onNudge={(delta) => setStops(nudge(current, i, delta))}
            nameTestID={`plan-stop-name-${i}`}
            timeTestID={`plan-stop-time-${i}`}
            earlierTestID={`plan-stop-earlier-${i}`}
            onRemove={() => { fireHaptic('light'); setStops(remove(current, i)); }}
            onMove={(dir) => setStops(move(current, i, dir === 'up' ? i - 1 : i + 1))}
          />

          {/* How you get to the next stop, under the card it leaves and
              inside the rail's row, so the line runs past it. The same
              glyph and the same "km · ≈ min" the options card and the
              saved trip print, so one journey keeps one appearance; the
              reference draws it as a bordered pill with a chevron, and a
              chevron promises a screen that does not exist. */}
          {legs[i] && <LegRow leg={legs[i]!} style={s.leg} />}
            </View>
          </View>
        </Animated.View>
        );
      })}
    </>
  );
}

/** Under the stops: Save, or the way back from a plan cut down to nothing. */
export function PlanFoot({ count, saving, onSave, onBack, guest }: {
  count: number;
  saving: boolean;
  onSave: () => Promise<void>;
  onBack: () => void;
  guest: boolean;
}) {
  const { t } = useI18n();
  return (
    <>
      {count === 0 && (
        <Card style={s.card}><Text style={s.body}>
          {t('Nothing left in this plan.', 'Không còn điểm nào trong plan này.', 'このプランには何も残っていません。', '这个计划里已经没有地点了。', '這個計畫裡已經沒有地點了。')}
        </Text></Card>
      )}

      {/* One button, the width of the screen. It is the only thing here
          that does anything. */}
      {/* With the summary line gone, the air it carried above Save is
          the wrapper's. */}
      <View style={s.save} />
      {/* An emptied plan has nothing to save, so it is not offered: the
          button used to stay lit, a guest's tap asked them to sign in
          to save nothing, and a reader's tap did nothing at all
          (PLAN-02, 17 Oct 2026). What is offered is the way back to the
          options this one was picked from — the plan was chosen there,
          and choosing again is the one useful next step. No undo: the
          owner's call, and the options are one tap away. */}
      {count > 0 ? (
        <GradientCta
          icon="checkmark"
          wide
          label={saving
            ? t('Saving…', 'Đang lưu…', '保存中…', '保存中…', '儲存中…')
            : t('Save to Trips', 'Lưu vào Chuyến đi', '旅程に保存', '保存到行程', '儲存到行程')}
          onPress={() => { if (!saving) void onSave(); }}
          testID="plan-save"
        />
      ) : (
        <GradientCta
          icon="arrow-back"
          wide
          label={t('Choose another option', 'Chọn lại phương án', '別のプランを選ぶ', '选择其他方案', '選擇其他方案')}
          onPress={onBack}
          testID="plan-choose-again"
        />
      )}

      {/* A line under the button only for the guest, who has no other
          way to know the tap will raise a sign-in sheet rather than
          save. The signed-in reader had one too — "saved trips go to
          Trips, where you can invite your crew" — and it went: the
          button already says where the trip goes, the screen goes
          there itself after the save, and the invite control is the
          first thing on that tab. Before that it promised the times
          "stay editable after saving", which TripDetail, being
          view-only, never kept; a caption that has been wrong once and
          redundant once is a caption the button does not need. */}
      {guest && count > 0 && (
        <Text style={s.note}>
          {t(
            'Sign in to save this trip.',
            'Đăng nhập để lưu chuyến đi này.',
            'この旅程を保存するにはサインインしてください。',
            '登录后即可保存这个行程。', '登入後即可儲存這個行程。',
          )}
        </Text>
      )}
    </>
  );
}

/** The plan is not there to edit. */
export function Gone({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  return (
    <Screen compactTitle title={t('Plan a trip', 'Lên kế hoạch', 'プランを立てる', '规划行程', '規劃行程')} onBack={onBack} backBare>
      <Card style={s.card}><Text style={s.body}>
        {t('That plan is no longer available.', 'Phương án đó không còn nữa.', 'そのプランはもう利用できません。', '这个计划已不可用。', '這個計畫已不可用。')}
      </Text></Card>
    </Screen>
  );
}
