// Whether the keyboard is up, for something that sits on it.
//
// A field at the foot of a page stands on the phone's own margin — the
// home indicator's 34pt — while the keyboard is away, and on the
// keyboard while it is up, where that margin would be a gap between the
// two. `Will`, not `Did`: the margin goes as the keyboard starts to
// rise and not a beat after it has landed. iOS alone sends `Will`, and
// iOS alone has the indicator; on Android this is always false, and
// there is nothing for it to take away.

import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

export function useKeyboardUp(): boolean {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const rise = Keyboard.addListener('keyboardWillShow', () => setUp(true));
    const fall = Keyboard.addListener('keyboardWillHide', () => setUp(false));
    return () => { rise.remove(); fall.remove(); };
  }, []);
  return up;
}
