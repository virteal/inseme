import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "geoportal-extensions-leaflet";
import "geoportal-extensions-leaflet/dist/GpPluginLeaflet.css";

export default function GeoportalControls() {
  const map = useMap();

  useEffect(() => {
    // Prevent adding controls multiple times if component re-renders
    // We check if a specific control (like LayerSwitcher) is already present
    // or we just trust the cleanup function.
    // However, L.geoportalLayer.WMTS creates layers, not just controls.

    // 1. Add IGN Layers
    // Plan IGN (Standard)
    const planIGN = L.geoportalLayer.WMTS({
      layer: "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2",
    });

    // Orthophotos (Aerial)
    const ortho = L.geoportalLayer.WMTS({
      layer: "ORTHOIMAGERY.ORTHOPHOTOS",
    });

    // Cadastre (Parcels) - Overlay
    const cadastre = L.geoportalLayer.WMTS({
      layer: "CADASTRALPARCELS.PARCELLAIRE_EXPRESS",
      opacity: 0.7,
    });

    // Add default layer to map
    planIGN.addTo(map);

    // 2. Add Layer Switcher
    const layerSwitcher = L.geoportalControl.LayerSwitcher({
      layers: [
        { layer: planIGN, config: { title: "Plan IGN", visibility: true } },
        { layer: ortho, config: { title: "Orthophotos", visibility: false } },
        { layer: cadastre, config: { title: "Cadastre", visibility: false } },
      ],
      options: { collapsed: true },
    });
    map.addControl(layerSwitcher);

    // 3. Add Search Engine (Address Search)
    const searchEngine = L.geoportalControl.SearchEngine({
      displayAdvancedSearch: false,
      zoomTo: "auto",
      placeholder: "Rechercher une adresse, un lieu...",
    });
    map.addControl(searchEngine);

    // 4. Add Mouse Position
    const mousePosition = L.geoportalControl.MousePosition({
      collapsed: true,
      displayAltitude: true, // If we have DTM configured, but simple coords are fine too
    });
    map.addControl(mousePosition);

    // 5. Add Reverse Geocode (Click to get address)
    const reverseGeocode = L.geoportalControl.ReverseGeocode({
      collapsed: true,
    });
    map.addControl(reverseGeocode);

    // Cleanup function
    return () => {
      // Remove controls
      map.removeControl(layerSwitcher);
      map.removeControl(searchEngine);
      map.removeControl(mousePosition);
      map.removeControl(reverseGeocode);

      // Remove layers
      map.removeLayer(planIGN);
      map.removeLayer(ortho);
      map.removeLayer(cadastre);
    };
  }, [map]);

  return null;
}
