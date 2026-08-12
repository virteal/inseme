import { useCallback, useEffect, useState } from "react";
import OleoleMap from "../components/OleoleMap.jsx";
import TimeSelector from "../components/TimeSelector.jsx";
import PresencePanel from "../components/PresencePanel.jsx";
import PresenceModeControl from "../components/PresenceModeControl.jsx";
import JohnChat from "../components/JohnChat.jsx";
import LangSwitch from "../components/LangSwitch.jsx";
import { I18nProvider, useI18n } from "../i18n/I18nContext.jsx";
import { getOrCreateSubjectRef } from "../lib/auto-presence.js";
import { PLACES_SEED } from "../lib/places-seed.js";
import {
  localDeclareClaim,
  localGetAggregates,
  localListPlaces,
  localRevokeAll,
} from "../lib/local-presence.js";
import { classifyOleoleHost } from "../lib/facade-host.js";
import "../styles/oleole.css";

const API = "/api/oleole";

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.locale ? { "X-Oleole-Locale": options.locale } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.ok && data.error) throw new Error(data.error);
  return data;
}

function mergeAggregates(serverAgg, localAgg) {
  const byPlace = new Map();
  for (const a of [...(serverAgg || []), ...(localAgg || [])]) {
    const prev = byPlace.get(a.place_ref);
    if (!prev) {
      byPlace.set(a.place_ref, { ...a, intents: { ...a.intents } });
      continue;
    }
    prev.count += a.count;
    for (const k of Object.keys(a.modalities || {})) {
      prev.modalities[k] = (prev.modalities[k] || 0) + a.modalities[k];
    }
    for (const k of ["discovery", "social", "oleole"]) {
      prev.intents[k] = (prev.intents[k] || 0) + (a.intents?.[k] || 0);
    }
  }
  return [...byPlace.values()].sort((a, b) => b.count - a.count);
}

function OleoleHomeInner() {
  const { t, locale } = useI18n();
  const [subjectRef] = useState(() => getOrCreateSubjectRef());
  const [windowKey, setWindowKey] = useState("now");
  const [places, setPlaces] = useState(PLACES_SEED);
  const [aggregates, setAggregates] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [focus, setFocus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [panel, setPanel] = useState("contribute");
  const [apiOnline, setApiOnline] = useState(null);

  const refresh = useCallback(async () => {
    const local = localGetAggregates(windowKey, locale);
    try {
      const [p, a] = await Promise.all([
        api("/places", { locale }),
        api(`/presence?window=${windowKey}&lang=${locale}`, { locale }),
      ]);
      setApiOnline(true);
      if (p.places?.length) setPlaces(p.places);
      setAggregates(mergeAggregates(a.aggregates || [], local.aggregates || []));
    } catch {
      setApiOnline(false);
      setPlaces(localListPlaces());
      setAggregates(local.aggregates || []);
    }
  }, [windowKey, locale]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("lang") !== locale) {
        url.searchParams.set("lang", locale);
        window.history.replaceState({}, "", url);
      }
    } catch {
      /* ignore */
    }
  }, [locale]);

  async function declare(payload) {
    setBusy(true);
    setFlash("");
    try {
      let result;
      try {
        const { subject_ref: _localSubjectRef, ...serverPayload } = payload;
        result = await api("/presence", {
          method: "POST",
          locale,
          body: JSON.stringify(serverPayload),
        });
        setApiOnline(true);
      } catch {
        result = localDeclareClaim({ ...payload, subject_ref: subjectRef });
        setApiOnline(false);
      }
      if (!result.ok) throw new Error((result.errors || [t("flash.failed")]).join(", "));
      setFlash(t("flash.published"));
      await refresh();
    } catch (err) {
      setFlash(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function revokeAll() {
    setBusy(true);
    try {
      try {
        await api("/presence/revoke", {
          method: "POST",
          locale,
          body: JSON.stringify({ all: true }),
        });
        setApiOnline(true);
      } catch {
        localRevokeAll(subjectRef);
        setApiOnline(false);
      }
      setFlash(t("flash.revoked"));
      await refresh();
    } catch (err) {
      setFlash(err.message);
    } finally {
      setBusy(false);
    }
  }

  function onSelectPlace(place) {
    setSelectedPlace(place);
    setFocus({ lat: place.lat, lng: place.lng, zoom: 12 });
    setPanel("contribute");
  }

  function onMapContext(ctx) {
    if (ctx?.window) setWindowKey(ctx.window);
    if (ctx?.focus_place) {
      const p = places.find((x) => x.id === ctx.focus_place);
      if (p) {
        setSelectedPlace(p);
        setFocus({ lat: p.lat, lng: p.lng, zoom: 11 });
      }
    }
    refresh();
  }

  return (
    <div className="oleole-app" lang={locale}>
      <header className="oleole-header">
        <div className="oleole-brand">
          <span className="oleole-brand__mark" aria-hidden />
          <div>
            <h1 className="oleole-brand__title">{t("meta.title")}</h1>
            <p className="oleole-brand__sub">{t("brand.subtitle")}</p>
          </div>
        </div>
        <div className="oleole-header__controls">
          <LangSwitch />
          <TimeSelector value={windowKey} onChange={setWindowKey} />
        </div>
      </header>

      <div className="oleole-banner oleole-banner--proto" role="status">
        {t("proto.banner")}
        {apiOnline === false ? ` · ${t("proto.localMode")}` : ""}
      </div>
      <div className="oleole-banner" role="note">
        {t("disclaimer.banner")}
      </div>

      <main className="oleole-main">
        <section className="oleole-map-wrap" aria-label={t("map.aria")}>
          <OleoleMap
            places={places}
            aggregates={aggregates}
            focus={focus}
            onSelectPlace={onSelectPlace}
          />
        </section>

        <aside className="oleole-side">
          <nav className="oleole-tabs" aria-label={t("nav.panelsAria")}>
            {[
              ["contribute", "nav.contribute"],
              ["mode", "nav.mode"],
              ["john", "nav.john"],
            ].map(([id, key]) => (
              <button
                key={id}
                type="button"
                className={panel === id ? "oleole-chip oleole-chip--active" : "oleole-chip"}
                onClick={() => setPanel(id)}
              >
                {t(key)}
              </button>
            ))}
          </nav>

          {panel === "contribute" && (
            <PresencePanel
              places={places}
              selectedPlace={selectedPlace}
              onDeclare={declare}
              onRevokeAll={revokeAll}
              busy={busy}
            />
          )}
          {panel === "mode" && (
            <PresenceModeControl
              subjectRef={subjectRef}
              onPublish={declare}
              onPolicyChange={async (policy) => {
                const { subject_ref: _localSubjectRef, ...serverPolicy } = policy;
                try {
                  await api("/policy", {
                    method: "POST",
                    locale,
                    body: JSON.stringify(serverPolicy),
                  });
                } catch {
                  /* local policy still applies */
                }
              }}
            />
          )}
          {panel === "john" && (
            <JohnChat subjectRef={subjectRef} windowKey={windowKey} onMapContext={onMapContext} />
          )}

          {flash ? (
            <p className="oleole-status" role="status">
              {flash}
            </p>
          ) : null}

          <footer className="oleole-footer">
            <p>{t("footer.blurb")}</p>
            <p className="oleole-footer__publisher">
              {classifyOleoleHost(
                typeof window !== "undefined" ? window.location.hostname : "",
                typeof window !== "undefined" ? window.location.search : ""
              ).role === "jhn_facet"
                ? t("footer.publisher.facet")
                : t("footer.publisher")}
            </p>
          </footer>
        </aside>
      </main>
    </div>
  );
}

export default function OleoleHome() {
  return (
    <I18nProvider>
      <OleoleHomeInner />
    </I18nProvider>
  );
}
