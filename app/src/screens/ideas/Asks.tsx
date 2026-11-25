// Out of `IdeasScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.

import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tile } from '../../components/ui';
import { CATEGORIES, categoryLabel } from '../../lib/categories';
import { useI18n } from '../../lib/i18n';
import { COMPANY, toggle, type TripDraft } from '../../lib/trip';
import { Section } from './parts';

/** The first two questions: who the day is for, and what sounds good. */
export function Asks({ draft, cats, onCompany, onCategories }: {
  draft: TripDraft;
  /** The categories this city has. */
  cats: string[];
  onCompany: (c: TripDraft['company']) => void;
  onCategories: (c: string[]) => void;
}) {
  const { t } = useI18n();
  return (
    <>
    {/* The three headers below open a sentence and the chips finish
        it — "Going with… ✓ Friends". They used to be questions
        ("Who's coming?"), which read as a form to fill in; a copy
        edit here should keep them as openers the chip labels can
        complete, ellipsis and all. */}
    <Section title={t('Going with…', 'Bạn muốn đi cùng…', '一緒に行くのは…', '和谁一起…', '和誰一起…')} cols={4}>
      {COMPANY.map((c) => (
        <Tile
          key={c.key}
          label={t(c.en, c.vi, c.ja, c.zh, c.hant)}
          icon={c.icon as keyof typeof Ionicons.glyphMap}
          active={draft.company === c.key}
          testID={`ideas-company-${c.key}`}
          onPress={() => onCompany(draft.company === c.key ? null : c.key)}
        />
      ))}
    </Section>

    {/* No cap on this group and there must not be one: `planner.ts`
        sizes the outing from how many were named, so a limit here
        would quietly shorten somebody's day. Nothing says so on
        screen, because nothing needs to — an unlimited choice is the
        one that needs no rule explained. */}
    <Section title={t('In the mood for…', 'Hôm nay bạn thích…', '今日の気分は…', '想去哪类地方…', '想去哪類地方…')} cols={3}>
      {cats.map((c, i) => (
        <Tile
          key={c}
          testID={`ideas-cat-${i}`}
          label={categoryLabel(c, t)}
          icon={CATEGORIES[c]?.icon ?? 'ellipse-outline'}
          active={draft.categories.includes(c)}
          onPress={() => onCategories(toggle(draft.categories, c))}
        />
      ))}
    </Section>
    </>
  );
}
