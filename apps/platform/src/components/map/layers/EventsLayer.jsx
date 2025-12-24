import React from "react";
import { Marker, Popup } from "react-leaflet";
import { Link } from "react-router-dom";

export default function EventsLayer({ events }) {
  return (
    <>
      {events.map((item) => {
        const { id, title, subtitle, eventDate } = item;
        const location = item.location || (item.metadata && item.metadata.location);

        if (!location || !location.lat || !location.lng) return null;

        return (
          <Marker key={id} position={[location.lat, location.lng]}>
            <Popup>
              <div className="text-sm">
                <h3 className="font-bold">{title}</h3>
                {subtitle && <p className="italic">{subtitle}</p>}
                <p className="mt-1">Date: {eventDate.toLocaleDateString()}</p>
                <Link
                  to={`/social?tab=posts&linkedType=post&linkedId=${id}`}
                  className="text-blue-600 underline"
                >
                  Voir l'événement
                </Link>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
