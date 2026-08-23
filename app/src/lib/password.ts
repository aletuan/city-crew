// Password strength, scored for the meter under the two fields where a
// password is invented: sign-up and reset. Sign-in never scores — grading
// a password that already exists helps nobody type it.
//
// The score is advice, not a gate. The only rule enforced anywhere is the
// eight-character minimum, checked at submit and by the server; the meter
// exists so the advice arrives while the password is still being chosen
// rather than as a refusal after it has been.
//
// Length first, variety second, in that order on purpose. Composition
// rules ("one capital, one digit, one symbol") train people into
// `Kittens1!`, which every cracking dictionary tries early; NIST 800-63B
// dropped them for exactly that reason. So length carries most of the
// score here, variety adds to it, and nothing is ever *required* beyond
// the minimum.
//
// Not zxcvbn. The real thing estimates guesses from dictionaries this
// module cannot afford to ship; what lives here instead is the shortlist
// of ways a password that satisfies every rule is still the first thing
// tried: the classics, their l33t spellings, keyboard rows, and runs.
// A meter this size can be wrong upward — it will call some crackable
// passwords Fair — but the floor is honest: what it calls Weak, is.
//
// No imports, so it runs in a plain Node test.

export const PASSWORD_MIN = 8;

/**
 * 0 is nothing typed yet — the meter has no opinion about an empty field.
 * 1 is Weak: under the minimum, or guessable no matter how it is dressed.
 * 2..4 are Fair, Good, Strong.
 */
export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

/**
 * The classics, base form only. Suffix digits are stripped and l33t
 * spellings undone before the lookup, so `password`, `Password123` and
 * `P@ssw0rd` all land on the same entry — the list stays short because
 * the normalising does the multiplying. `trustno1` is stored literally:
 * its digit is the password, not a decoration on one.
 */
const COMMON = new Set([
  'password', 'passwort', 'qwerty', 'letmein', 'welcome', 'monkey',
  'dragon', 'football', 'baseball', 'basketball', 'superman', 'batman',
  'starwars', 'pokemon', 'princess', 'sunshine', 'iloveyou', 'whatever',
  'trustno1', 'freedom', 'master', 'shadow', 'mustang', 'computer',
  'internet', 'samsung', 'secret', 'access', 'abcd1234', 'citycrew',
]);

/** The substitutions people believe disguise a word. */
const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
  '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i',
};

const unleet = (s: string): string => s.replace(/[0134578@$!]/g, (c) => LEET[c]);

/** The rows a hand can sweep, forward or backward. */
const ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

function isCommon(password: string): boolean {
  const lower = password.toLowerCase();
  // `2024` off the end before the l33t pass, or `password1` decodes its
  // own suffix into `passwordi` and walks past the list.
  const bare = lower.replace(/\d+$/, '');
  return [lower, unleet(lower), bare, unleet(bare)].some((c) => COMMON.has(c));
}

/** Every step exactly +1 or every step exactly −1: abcdefgh, 987654321. */
function isRun(s: string): boolean {
  let up = true;
  let down = true;
  for (let i = 1; i < s.length; i++) {
    const step = s.charCodeAt(i) - s.charCodeAt(i - 1);
    if (step !== 1) up = false;
    if (step !== -1) down = false;
  }
  return up || down;
}

function isPattern(password: string): boolean {
  const lower = password.toLowerCase();
  // A short block repeated to fill the box: aaaaaaaa, abababab, abcdabcd.
  if (/^(.{1,4})\1+$/.test(lower)) return true;
  if (isRun(lower)) return true;
  return ROWS.some((row) => {
    const back = [...row].reverse().join('');
    return row.includes(lower) || back.includes(lower);
  });
}

/**
 * Length earns points at 8, 12, 16 and 20 characters; each character
 * class beyond the first — lower, upper, digit, everything else — earns
 * one more. The sum maps to Fair, Good, Strong.
 *
 * The steps mean a 12-character password with a digit in it reads Good,
 * a 16-character one with mixed case and digits reads Strong, and a
 * four-word passphrase with its spaces reads Strong on length almost
 * alone — which is the NIST posture: the advice is "longer", never
 * "more kinds of character", though more kinds still count.
 *
 * A 20-character single-class string stops at Good, not out of doubt
 * about passphrases but because this function cannot tell one from
 * `qqqqwwwweeeerrrrtttt` — its patterns catch some mush, not all of it.
 * One space or capital anywhere is the difference, and that is a fair
 * price for a meter that never overpromises.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return 0;
  if (password.length < PASSWORD_MIN) return 1;
  if (isCommon(password) || isPattern(password)) return 1;
  const classes =
    +/[a-z]/.test(password) + +/[A-Z]/.test(password) +
    +/[0-9]/.test(password) + +/[^a-zA-Z0-9]/.test(password);
  const length =
    password.length >= 20 ? 4 : password.length >= 16 ? 3 : password.length >= 12 ? 2 : 1;
  const score = length + (classes - 1);
  if (score <= 2) return 2;
  if (score <= 4) return 3;
  return 4;
}
