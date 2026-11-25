// SignUpScreen's stylesheet: as it was in one file.

import { StyleSheet } from 'react-native';
import { colors, font, type } from '../../theme';

export const s = StyleSheet.create({
  // The one screen in this flow with no back control, so it carries the
  // title itself rather than through AuthHeader.
  tasteTitle: { color: colors.text, ...type.titleDetail, marginBottom: 2 },
  // Quieter than the Lede and above the button: a statement of fact the
  // reader should meet, not a second instruction competing with the one
  // the screen is actually asking.
  privacyNote: { color: colors.textSecondary, fontSize: 14, lineHeight: 19, marginTop: 14, marginBottom: 4 },
  // The other answer, offered rather than hidden. Centred under the
  // button it is an alternative to, and underlined because it is the one
  // piece of running text on these screens that is a control — the app
  // underlines nothing else, which is exactly what makes it read as
  // something to press here.
  skip: {
    color: colors.textSecondary, ...type.meta, textAlign: 'center',
    textDecorationLine: 'underline', paddingVertical: 6,
  },
  // The hero's box: taller than it was, and bled past the page padding —
  // no explicit width, so the column stretches it and the negative
  // margins count. `contain` inside the fixed height keeps the title's
  // position steady whatever the screen's width. The top margin is the
  // reference's air: with the lower half deliberately empty, the drawing
  // sits down into the screen instead of hanging off the status bar.
  plane: { height: 250, marginHorizontal: -14, marginTop: 40 },
  // The greeting, one size up from the step titles: this screen has one
  // thing to say and the room to say it. `flexShrink` so the name, not
  // the heart, is what gives when the row runs out of room.
  welcomeTitleRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 6, marginTop: 10 },
  welcomeTitle: { color: colors.text, ...type.titleDetail, textAlign: 'center', flexShrink: 1 },
  // Nudged toward the cap height, where a hand would draw it.
  welcomeHeart: { marginTop: 3 },
  welcomeLede: { color: colors.textSecondary, ...type.body, lineHeight: 24, textAlign: 'center', marginBottom: 2 },
  terms: { color: colors.textTertiary, ...type.meta, textAlign: 'center', lineHeight: 26, marginTop: 4 },
  // Only the colour and the weight change: a different size inside a
  // sentence would break the line's rhythm, and there is no underline
  // anywhere else in the app.
  termsLink: { color: colors.accent, fontWeight: font.medium },
});
