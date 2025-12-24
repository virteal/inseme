import { useState } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import useSWR from "swr";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function MunicipalEventsLayer() {
  const { data: events, error } = useSWR("/api/municipal/events", fetcher);

  if (error) console.error("Error loading Events:", error);
  if (!events) return null;

  // Filter events that have location data
  const locatedEvents = events.filter(
    (e) => e.location || (e.description && e.description.includes("lat"))
  );
  // TODO: The API currently returns a simple list.
  // If the backend 'geom' column is populated, we should return GeoJSON or explicit lat/lng.
  // For now, this layer is a placeholder until the API returns coordinates properly.

  // If no coordinates are returned yet, we can't display markers.
  // However, we can display a list or "non-map" UI if needed,
  // but a Map Layer specifically needs coords.

  return null;
}
