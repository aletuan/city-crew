import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type Lang = 'en' | 'vi';

type I18n = {
  lang: Lang;
  toggle: () => void;
  /** Pick the right variant of a bilingual pair. */
  t: (en: string | null | undefined, vi: string | null | undefined) => string;
};

const Ctx = createContext<I18n>({ lang: 'en', toggle: () => {}, t: (en) => en ?? '' });

export const useI18n = () => useContext(Ctx);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');
  const toggle = useCallback(() => setLang((l) => (l === 'en' ? 'vi' : 'en')), []);
  const value = useMemo<I18n>(() => ({
    lang,
    toggle,
    t: (en, vi) => (lang === 'vi' ? vi ?? en ?? '' : en ?? vi ?? ''),
  }), [lang, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
