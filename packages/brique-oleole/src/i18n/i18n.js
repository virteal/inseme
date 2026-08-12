import { DEFAULT_LOCALE, LOCALES, messages } from "./messages.js";

const STORAGE_KEY = "oleole.locale";

export function normalizeLocale(value) {
  if (!value) return DEFAULT_LOCALE;
  const base = String(value).toLowerCase().split(/[-_]/)[0];
  return LOCALES.includes(base) ? base : DEFAULT_LOCALE;
}

/** Browser / stored preference. Query ?lang=en wins when provided. */
export function detectLocale({ search = "", storage = null, navigatorLang = null } = {}) {
  try {
    const params = new URLSearchParams(
      search || (typeof window !== "undefined" ? window.location.search : "")
    );
    const fromQuery = params.get("lang") || params.get("locale");
    if (fromQuery) return normalizeLocale(fromQuery);
  } catch {
    /* ignore */
  }

  try {
    const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    const saved = store?.getItem(STORAGE_KEY);
    if (saved) return normalizeLocale(saved);
  } catch {
    /* ignore */
  }

  const nav =
    navigatorLang ||
    (typeof navigator !== "undefined" ? navigator.language || navigator.userLanguage : null);
  return normalizeLocale(nav);
}

export function persistLocale(locale) {
  const lang = normalizeLocale(locale);
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  return lang;
}

/**
 * Interpolate `{name}` placeholders.
 * @param {string} template
 * @param {Record<string, string|number>} [vars]
 */
export function formatMessage(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] != null ? String(vars[key]) : `{${key}}`
  );
}

export function translate(locale, key, vars) {
  const lang = normalizeLocale(locale);
  const table = messages[lang] || messages[DEFAULT_LOCALE];
  const fallback = messages[DEFAULT_LOCALE];
  const raw = table[key] ?? fallback[key] ?? key;
  return vars ? formatMessage(raw, vars) : raw;
}

export function createTranslator(locale) {
  const lang = normalizeLocale(locale);
  return (key, vars) => translate(lang, key, vars);
}

export { DEFAULT_LOCALE, LOCALES, STORAGE_KEY, messages };
