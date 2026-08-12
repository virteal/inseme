import { TIME_WINDOWS } from "../lib/presence-core.js";
import { useI18n } from "../i18n/I18nContext.jsx";

export default function TimeSelector({ value = "now", onChange }) {
  const { t } = useI18n();

  return (
    <div className="oleole-time" role="group" aria-label={t("time.aria")}>
      {Object.entries(TIME_WINDOWS).map(([key, def]) => (
        <button
          key={key}
          type="button"
          className={value === key ? "oleole-chip oleole-chip--active" : "oleole-chip"}
          onClick={() => onChange?.(key)}
          aria-pressed={value === key}
        >
          {t(def.labelKey)}
        </button>
      ))}
    </div>
  );
}
