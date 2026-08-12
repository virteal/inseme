import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, detectLocale, normalizeLocale, persistLocale, translate } from "./i18n.js";

const I18nContext = createContext({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children, initialLocale }) {
  const [locale, setLocaleState] = useState(
    () => initialLocale || detectLocale() || DEFAULT_LOCALE
  );

  const setLocale = useCallback((next) => {
    const lang = persistLocale(normalizeLocale(next));
    setLocaleState(lang);
  }, []);

  const t = useCallback((key, vars) => translate(locale, key, vars), [locale]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      const title = translate(locale, "meta.title");
      if (title) document.title = title;
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", translate(locale, "meta.description"));
    }
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
