import React, { useState } from "react";
import { useMap } from "react-leaflet";
import { Marker, Popup } from "react-leaflet";

export default function LocateControl() {
  const map = useMap();
  const [position, setPosition] = useState(null);

  const handleLocate = () => {
    map.locate().on("locationfound", function (e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    });
  };

  return (
    <>
      <div className="leaflet-bottom leaflet-left">
        <div className="leaflet-control leaflet-bar">
          <a
            href="#"
            title="Me localiser"
            role="button"
            aria-label="Me localiser"
            onClick={(e) => {
              e.preventDefault();
              handleLocate();
            }}
            className="flex items-center justify-center w-[30px] h-[30px] bg-white text-black hover:bg-gray-100"
            style={{ fontSize: "18px", lineHeight: "30px" }}
          >
            📍
          </a>
        </div>
      </div>
      {position && (
        <Marker position={position}>
          <Popup>Vous êtes ici</Popup>
        </Marker>
      )}
    </>
  );
}
