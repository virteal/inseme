import React from "react";

const STATUS_LABELS = {
  open: "Ouvert",
  investigating: "Investigation",
  monitoring: "Surveillance",
  resolved: "Résolu",
};

const SEVERITY_LABELS = {
  low: "Faible",
  medium: "Modérée",
  high: "Élevée",
  critical: "Critique",
};

export default function IncidentInfo({ incident }) {
  if (!incident) return null;

  const { status, severity, impact, nextUpdate, contact } = incident;
  const formattedNextUpdate = nextUpdate
    ? new Date(nextUpdate).toLocaleString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="mb-4 p-4 border border-yellow-300 bg-yellow-50 text-yellow-900 text-sm space-y-2">
      <div className="flex flex-wrap gap-4">
        {status && (
          <span className="font-semibold">Statut : {STATUS_LABELS[status] || status}</span>
        )}
        {severity && (
          <span className="font-semibold">Sévérité : {SEVERITY_LABELS[severity] || severity}</span>
        )}
      </div>
      {impact && (
        <p>
          <span className="font-semibold">Impact :</span> {impact}
        </p>
      )}
      {formattedNextUpdate && (
        <p>
          <span className="font-semibold">Prochaine mise à jour :</span> {formattedNextUpdate}
        </p>
      )}
      {contact && (
        <p>
          <span className="font-semibold">Contact :</span> {contact}
        </p>
      )}
    </div>
  );
}
