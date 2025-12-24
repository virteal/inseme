import React from "react";

export default function EventInfo({ event }) {
  if (!event) return null;

  const { date, location, duration } = event;

  const formattedDate = date
    ? new Date(date).toLocaleString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="mb-3 text-sm text-gray-700">
      {formattedDate && (
        <div>
          📅 <strong>Date:</strong> {formattedDate}
        </div>
      )}
      {location && (
        <div>
          📍 <strong>Lieu:</strong> {location}
        </div>
      )}
      {duration && (
        <div>
          ⏱️ <strong>Durée:</strong> {duration}
        </div>
      )}
    </div>
  );
}
