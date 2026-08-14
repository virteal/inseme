/* eslint-env deno */
/**
 * Shared Corsica territorial-context endpoint.
 *
 * The request carries only a coarse foreground coordinate or a public place
 * centre. It creates no identity, cookie, presence claim, or location record.
 */

import { isCorsicaCoordinate } from "../lib/context-location.js";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}

function numberParam(params, key) {
  const value = Number(params.get(key));
  return Number.isFinite(value) ? value : null;
}

function weatherCode(code) {
  const labels = {
    0: "clear",
    1: "mostly-clear",
    2: "partly-cloudy",
    3: "overcast",
    45: "fog",
    48: "rime-fog",
    51: "light-drizzle",
    53: "drizzle",
    55: "heavy-drizzle",
    61: "light-rain",
    63: "rain",
    65: "heavy-rain",
    71: "light-snow",
    73: "snow",
    75: "heavy-snow",
    80: "rain-showers",
    81: "rain-showers",
    82: "heavy-showers",
    95: "thunderstorm",
    96: "thunderstorm-hail",
    99: "heavy-thunderstorm-hail",
  };
  return labels[code] || "unknown";
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  const lat = numberParam(url.searchParams, "lat");
  const lng = numberParam(url.searchParams, "lng");
  if (!isCorsicaCoordinate(lat, lng)) {
    return json({ error: "corsica_location_required" }, 400);
  }

  const upstream = new URL(OPEN_METEO_URL);
  upstream.searchParams.set("latitude", String(lat));
  upstream.searchParams.set("longitude", String(lng));
  upstream.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,weather_code,wind_speed_10m"
  );
  upstream.searchParams.set("timezone", "Europe/Paris");

  try {
    const response = await fetch(upstream, { headers: { Accept: "application/json" } });
    if (!response.ok) return json({ error: "atmosphere_source_unavailable" }, 503);
    const source = await response.json();
    const current = source.current;
    if (!current) return json({ error: "atmosphere_source_unavailable" }, 503);
    return json({
      ok: true,
      context: {
        location: { lat, lng, precision: url.searchParams.get("precision") || "coarse" },
        atmosphere: {
          epistemic_type: "observation",
          observed_at: current.time,
          fetched_at: new Date().toISOString(),
          freshness: "live",
          values: {
            temperature_c: current.temperature_2m,
            apparent_temperature_c: current.apparent_temperature,
            wind_kmh: current.wind_speed_10m,
            condition: weatherCode(current.weather_code),
          },
          source: {
            provider: "Open-Meteo",
            url: "https://open-meteo.com/",
            licence: "CC BY 4.0",
            note: "Prototype source; availability and terms must be reviewed before a public-scale release.",
          },
        },
        mobility: { status: "unknown", reason: "no_fresh_source" },
        energy: { status: "unknown", reason: "edf_collector_not_connected" },
        charging: { status: "unknown", reason: "irve_source_not_connected" },
        events: { status: "unknown", reason: "no_fresh_source" },
      },
    });
  } catch (error) {
    console.error("Corsica context source failed", { message: error?.message });
    return json({ error: "atmosphere_source_unavailable" }, 503);
  }
}
