import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "../lib/places-seed.js";
import { useI18n } from "../i18n/I18nContext.jsx";

function FocusController({ focus }) {
  const map = useMap();
  useEffect(() => {
    if (focus?.lat != null && focus?.lng != null) {
      map.flyTo([focus.lat, focus.lng], focus.zoom || 12, { duration: 0.6 });
    }
  }, [focus, map]);
  return null;
}

function radiusForCount(count) {
  return Math.min(28, 10 + Math.sqrt(count) * 6);
}

export default function OleoleMap({
  places = [],
  aggregates = [],
  focus = null,
  onSelectPlace,
  className = "oleole-map",
}) {
  const { t } = useI18n();

  const aggByPlace = useMemo(() => {
    const m = new Map();
    for (const a of aggregates) m.set(a.place_ref, a);
    return m;
  }, [aggregates]);

  function classLabel(classification) {
    const key = `class.${classification}`;
    const translated = t(key);
    return translated === key ? classification : translated;
  }

  return (
    <MapContainer
      center={DEFAULT_MAP_CENTER}
      zoom={DEFAULT_MAP_ZOOM}
      scrollWheelZoom
      className={className}
      style={{ height: "100%", width: "100%", minHeight: 320 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FocusController focus={focus} />

      {places.map((p) => {
        const agg = aggByPlace.get(p.id);
        const hasPresence = Boolean(agg?.count);
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={hasPresence ? radiusForCount(agg.count) : p.classification === "poi" ? 6 : 8}
            pathOptions={{
              color: hasPresence ? "#d63131" : "#1a1a1a",
              fillColor: hasPresence
                ? "#fbcb1c"
                : p.classification === "poi"
                  ? "#0a3fa0"
                  : "#fbf7f0",
              fillOpacity: hasPresence ? 0.75 : 0.55,
              weight: 2,
            }}
            eventHandlers={{
              click: () => onSelectPlace?.(p, agg || null),
            }}
          >
            <Popup>
              <div className="oleole-popup">
                <strong>{p.name}</strong>
                {p.name_co ? <div className="oleole-muted">{p.name_co}</div> : null}
                <div className="oleole-muted">{classLabel(p.classification)}</div>
                {hasPresence ? (
                  <div>
                    <div>{t("map.presenceCount", { count: agg.count })}</div>
                    <div className="oleole-disclaimer-sm">{t("map.aggregateNote")}</div>
                    {(agg.intents?.discovery || agg.intents?.social || agg.intents?.oleole) && (
                      <div className="oleole-intents">
                        {t("map.intents")}
                        {agg.intents.discovery ? ` ${t("map.intent.discovery")}` : ""}
                        {agg.intents.social ? ` ${t("map.intent.social")}` : ""}
                        {agg.intents.oleole ? ` ${t("map.intent.oleole")}` : ""}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="oleole-muted">{t("map.noPresence")}</div>
                )}
                {p.sources?.length ? (
                  <div className="oleole-disclaimer-sm">
                    {t("map.sources", { list: p.sources.map((s) => s.provider).join(", ") })}
                  </div>
                ) : null}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
