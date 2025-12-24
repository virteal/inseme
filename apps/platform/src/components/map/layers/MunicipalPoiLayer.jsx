import { useEffect, useState } from "react";
import { useMap, Marker, Popup } from "react-leaflet";
import L from "leaflet";
// Use a swr or simple fetch
import useSWR from "swr";

const fetcher = (url) => fetch(url).then((res) => res.json());

// Icons mapping based on category
const getIcon = (category) => {
  // TODO: Add refined icons from a library or custom assets
  let color = "blue";
  if (category?.toLowerCase().includes("sport")) color = "green";
  if (category?.toLowerCase().includes("culture")) color = "purple";
  if (
    category?.toLowerCase().includes("administration") ||
    category?.toLowerCase().includes("mairie")
  )
    color = "red";

  // Simple custom div icon or standard marker with color filter
  // For now using standard marker, but in 'real' app we'd use L.divIcon with SVG
  return new L.Icon.Default();
};

export default function MunicipalPoiLayer() {
  const map = useMap(); // Access map instance if needed for bounds
  const { data: geojson, error } = useSWR("/api/municipal/pois", fetcher);

  if (error) console.error("Error loading POIs:", error);
  if (!geojson) return null;

  return (
    <>
      {geojson.features.map((feature) => {
        const { geometry, properties } = feature;
        const [lng, lat] = geometry.coordinates;

        return (
          <Marker key={properties.id} position={[lat, lng]} icon={getIcon(properties.category)}>
            <Popup>
              <div className="p-2">
                <h3 className="font-bold text-lg">{properties.name}</h3>
                <div className="text-sm text-gray-600 mb-2">{properties.category}</div>
                {properties.description && (
                  <div className="text-sm mb-2 max-h-32 overflow-y-auto">
                    {properties.description}
                  </div>
                )}
                {/* External link if exists */}
                {/* Image if exists */}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
