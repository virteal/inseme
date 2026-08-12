import { useI18n } from "../i18n/I18nContext.jsx";
import { LOCALES } from "../i18n/i18n.js";

export default function LangSwitch() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="oleole-lang" role="group" aria-label={t("lang.aria")}>
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          className={
            locale === code
              ? "oleole-chip oleole-chip--active oleole-lang__btn"
              : "oleole-chip oleole-lang__btn"
          }
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          lang={code}
        >
          {t(`lang.${code}`)}
        </button>
      ))}
    </div>
  );
}
