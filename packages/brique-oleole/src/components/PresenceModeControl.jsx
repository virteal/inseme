import { useEffect, useRef, useState } from "react";
import {
  evaluateAutomaticClaim,
  loadPresencePolicy,
  pausePresencePolicy,
  rememberAutoClaimMeta,
  savePresencePolicy,
} from "../lib/auto-presence.js";
import { useI18n } from "../i18n/I18nContext.jsx";

/**
 * Automatic / assisted / off presence mode control.
 * Uses browser geolocation + significant-change detection; never streams raw GPS when precision is coarse.
 */
export default function PresenceModeControl({ subjectRef, onPublish, onPolicyChange }) {
  const { t } = useI18n();
  const [policy, setPolicy] = useState(() => loadPresencePolicy());
  const [status, setStatus] = useState("");
  const watchId = useRef(null);

  useEffect(() => {
    onPolicyChange?.(policy);
  }, [policy, onPolicyChange]);

  useEffect(() => {
    stopWatch();
    if (policy.mode !== "auto" || policy.paused) return undefined;
    if (!navigator.geolocation) {
      setStatus(t("mode.geoUnavailable"));
      return undefined;
    }

    setStatus(t("mode.autoActive"));
    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const decision = evaluateAutomaticClaim(pos, policy);
        if (decision.action !== "publish") return;
        try {
          await onPublish?.(decision.claim);
          rememberAutoClaimMeta(decision.meta);
          setStatus(
            t("mode.autoPublished", {
              place: decision.claim.place_name || decision.claim.place_ref,
            })
          );
        } catch (err) {
          setStatus(t("mode.autoFailed", { error: err.message }));
        }
      },
      (err) => setStatus(t("mode.geoError", { error: err.message })),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 20_000 }
    );

    return () => stopWatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policy.mode, policy.paused, policy.precision, t]);

  function stopWatch() {
    if (watchId.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }

  function setMode(mode) {
    const next = savePresencePolicy({
      ...policy,
      subject_ref: subjectRef,
      mode,
      paused: mode === "off",
    });
    setPolicy(next);
    setStatus(
      mode === "auto" ? t("mode.setAuto") : mode === "off" ? t("mode.setOff") : t("mode.setManual")
    );
  }

  function pauseNow() {
    const next = pausePresencePolicy();
    setPolicy(next);
    stopWatch();
    setStatus(t("mode.paused"));
  }

  const modeLabel = { manual: t("mode.manual"), auto: t("mode.auto"), off: t("mode.off") };

  return (
    <div className="oleole-panel oleole-panel--mode">
      <h2 className="oleole-panel__title">{t("mode.title")}</h2>
      <div className="oleole-intent-row">
        {["manual", "auto", "off"].map((mode) => (
          <button
            key={mode}
            type="button"
            className={policy.mode === mode ? "oleole-chip oleole-chip--active" : "oleole-chip"}
            onClick={() => setMode(mode)}
            aria-pressed={policy.mode === mode}
          >
            {modeLabel[mode]}
          </button>
        ))}
        <button type="button" className="oleole-chip" onClick={pauseNow}>
          {t("mode.pause")}
        </button>
      </div>
      <p className="oleole-disclaimer-sm">{t("mode.hint", { precision: policy.precision })}</p>
      {status ? <p className="oleole-status">{status}</p> : null}
    </div>
  );
}
