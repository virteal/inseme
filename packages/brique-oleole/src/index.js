export { default as OleoleHome } from "./pages/OleoleHome.jsx";
export { default as OleoleMap } from "./components/OleoleMap.jsx";
export { default as TimeSelector } from "./components/TimeSelector.jsx";
export { default as PresencePanel } from "./components/PresencePanel.jsx";
export { default as PresenceModeControl } from "./components/PresenceModeControl.jsx";
export { default as JohnChat } from "./components/JohnChat.jsx";
export { default as LangSwitch } from "./components/LangSwitch.jsx";
export { I18nProvider, useI18n } from "./i18n/I18nContext.jsx";
export {
  createTranslator,
  detectLocale,
  normalizeLocale,
  translate,
  LOCALES,
  DEFAULT_LOCALE,
} from "./i18n/i18n.js";

export {
  isOleoleFacade,
  isOleoleFacadeHost,
  isOleoleCanonicalHost,
  classifyOleoleHost,
  getActiveServiceContext,
  OLEOLE_CANONICAL_HOST,
  OLEOLE_JHN_FACET_HOST,
  OLEOLE_PUBLISHER,
} from "./lib/facade-host.js";

export * from "./lib/presence-core.js";
export * from "./lib/places-seed.js";
export * from "./lib/auto-presence.js";
export { createPresenceStore } from "./lib/presence-store.js";
