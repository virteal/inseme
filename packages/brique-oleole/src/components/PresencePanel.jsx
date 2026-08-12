import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";

const INTENT_KEYS = ["discovery", "social", "oleole"];

export default function PresencePanel({
  places = [],
  selectedPlace = null,
  onDeclare,
  onRevokeAll,
  busy = false,
}) {
  const { t } = useI18n();

  const municipalities = useMemo(
    () => places.filter((p) => p.classification === "municipality" || p.classification === "poi"),
    [places]
  );

  const [placeId, setPlaceId] = useState(selectedPlace?.id || "");
  const [modality, setModality] = useState("declared");
  const [precision, setPrecision] = useState("municipality");
  const [untilLocal, setUntilLocal] = useState("");
  const [intents, setIntents] = useState({ discovery: false, social: false, oleole: false });

  useEffect(() => {
    if (selectedPlace?.id) setPlaceId(selectedPlace.id);
  }, [selectedPlace?.id]);

  function toggleIntent(key) {
    setIntents((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function submit(e) {
    e.preventDefault();
    if (!placeId) return;
    const payload = {
      place_ref: placeId,
      modality,
      precision,
      visibility: "aggregate",
      source: "manual_ui",
      ...intents,
    };
    if (untilLocal) {
      payload.valid_until = new Date(untilLocal).toISOString();
    }
    if (modality === "intended" && !untilLocal) {
      const from = new Date();
      from.setDate(from.getDate() + 1);
      from.setHours(18, 0, 0, 0);
      const until = new Date(from);
      until.setHours(23, 0, 0, 0);
      payload.valid_from = from.toISOString();
      payload.valid_until = until.toISOString();
    }
    onDeclare?.(payload);
  }

  return (
    <form className="oleole-panel" onSubmit={submit}>
      <h2 className="oleole-panel__title">{t("panel.declareTitle")}</h2>
      <p className="oleole-disclaimer-sm">{t("panel.declareHint")}</p>

      <label className="oleole-field">
        <span>{t("panel.place")}</span>
        <select
          value={placeId}
          onChange={(e) => setPlaceId(e.target.value)}
          required
          className="oleole-input"
        >
          <option value="">{t("panel.choose")}</option>
          {municipalities.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.classification === "poi" ? t("panel.poiSuffix") : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="oleole-field">
        <span>{t("panel.type")}</span>
        <select
          value={modality}
          onChange={(e) => setModality(e.target.value)}
          className="oleole-input"
        >
          <option value="declared">{t("panel.modality.declared")}</option>
          <option value="intended">{t("panel.modality.intended")}</option>
        </select>
      </label>

      <label className="oleole-field">
        <span>{t("panel.precision")}</span>
        <select
          value={precision}
          onChange={(e) => setPrecision(e.target.value)}
          className="oleole-input"
        >
          <option value="municipality">{t("panel.precision.municipality")}</option>
          <option value="area">{t("panel.precision.area")}</option>
          <option value="poi">{t("panel.precision.poi")}</option>
        </select>
      </label>

      <label className="oleole-field">
        <span>{t("panel.validUntil")}</span>
        <input
          type="datetime-local"
          value={untilLocal}
          onChange={(e) => setUntilLocal(e.target.value)}
          className="oleole-input"
        />
      </label>

      <fieldset className="oleole-field">
        <legend>{t("panel.intentLegend")}</legend>
        <div className="oleole-intent-row">
          {INTENT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={intents[key] ? "oleole-chip oleole-chip--active" : "oleole-chip"}
              onClick={() => toggleIntent(key)}
              aria-pressed={intents[key]}
            >
              {t(`panel.intent.${key}`)}
            </button>
          ))}
        </div>
        <p className="oleole-disclaimer-sm">{t("panel.oleoleNote")}</p>
      </fieldset>

      <div className="oleole-actions">
        <button
          type="submit"
          className="oleole-btn oleole-btn--primary"
          disabled={busy || !placeId}
        >
          {t("panel.publish")}
        </button>
        <button
          type="button"
          className="oleole-btn oleole-btn--ghost"
          disabled={busy}
          onClick={() => onRevokeAll?.()}
        >
          {t("panel.revoke")}
        </button>
      </div>
    </form>
  );
}
