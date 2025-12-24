import React, { useState, useEffect } from "react";
import { useMapEvents, Marker, Popup } from "react-leaflet";

export default function LocationPicker({ onLocationSelect, initialPosition }) {
  const [position, setPosition] = useState(initialPosition);

  const map = useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      const newPos = [lat, lng];
      setPosition(newPos);
      if (onLocationSelect) {
        onLocationSelect({ lat, lng });
      }
    },
  });

  useEffect(() => {
    if (initialPosition) {
      setPosition(initialPosition);
    }
  }, [initialPosition]);

  return position === null ? null : (
    <Marker position={position}>
      <Popup>Position sélectionnée</Popup>
    </Marker>
  );
}
