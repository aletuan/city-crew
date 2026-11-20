// The copy button in a list's row of acts, with how many people copied
// it — `components/CopyCount` has the decision and what pressing does.
// After the comments, before Share: the two tallies the card has always
// had lead, then this one, then the owner's own act.
//
// Drawn where a copy can be made (`canCopy`: a city to file it under,
// and not a list lent to you) or, on your own list, once somebody has
// copied it — an owner's button with nothing behind it would open an
// empty page. A guest sees it too, figure and all; pressing asks them to
// sign in, as the ⋯ row does (`copy`).

import React from 'react';
import { Text } from 'react-native';
import { copyLabel, type CopyTarget, useCopyState } from '../../components/CopyCount';
import { PressableScale } from '../../components/ui';
import { Glyph } from '../../components/ui/glyph';
import { useI18n } from '../../lib/i18n';
import type { Nav } from '../../nav';
import { colors } from '../../theme';
import { ACT_GLYPH, s } from './styles';

export function CopyDoor({ list, canCopy, onCopy, navigation }: {
  /** The list on the page, or none while it is being found. */
  list: CopyTarget | null | undefined;
  /** A copy can be made of it here. */
  canCopy: boolean;
  /** Starts a copy: the ⋯ row's own act. */
  onCopy: () => void;
  /** Where the reader's copy, or the owner's activity page, opens. */
  navigation: Pick<Nav, 'navigate' | 'push'>;
}) {
  const { t } = useI18n();
  const stateOf = useCopyState();
  if (!list) return null;
  const st = stateOf(list);
  if (st.own ? st.n === 0 : !canCopy) return null;
  const press = () => {
    // The owner: who copied it. A reader's copy: on top of this page,
    // which is the original, so Back returns to it.
    if (st.own) navigation.navigate('CollectionActivity', { slug: list.slug });
    else if (st.copy) navigation.push('CollectionDetail', { slug: st.copy.slug });
    else onCopy();
  };
  const have = !!st.copy;
  return (
    <PressableScale
      contentStyle={s.like}
      scaleTo={0.82}
      haptic="selection"
      hitSlop={{ top: 14, bottom: 14, left: 12, right: 14 }}
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={copyLabel(st, t)}
      testID="collection-copy"
    >
      {/* Filled in the accent once it is yours, as the heart is: a state
          the reader made. */}
      <Glyph name={have ? 'copy' : 'copy-outline'} size={ACT_GLYPH} color={have ? colors.accent : colors.textSecondary} />
      {st.n > 0 ? <Text style={s.act} testID="collection-copy-count">{st.n}</Text> : null}
    </PressableScale>
  );
}
