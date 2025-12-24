import React from "react";

/**
 * Component for displaying job progress with realtime updates
 * @param {object} job - Job object from database
 * @param {boolean} showDetails - Whether to show detailed information
 * @param {function} onCancel - Callback when cancel button is clicked
 * @param {function} onRetry - Callback when retry button is clicked
 */
export default function JobProgress({ job, showDetails = true, onCancel, onRetry }) {
  if (!job) return null;

  const getStatusColor = () => {
    switch (job.status) {
      case "completed":
        return "green";
      case "running":
        return "blue";
      case "failed":
        return "red";
      case "cancelled":
        return "gray";
      case "pending":
        return "yellow";
      default:
        return "gray";
    }
  };

  const getStatusText = () => {
    switch (job.status) {
      case "completed":
        return "Terminé";
      case "running":
        return "En cours...";
      case "failed":
        return "Échec";
      case "cancelled":
        return "Annulé";
      case "pending":
        return "En attente";
      default:
        return job.status;
    }
  };

  const getStatusIcon = () => {
    switch (job.status) {
      case "completed":
        return (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "running":
        return (
          <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        );
      case "failed":
        return (
          <svg
            className="w-5 h-5 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        );
      case "cancelled":
        return (
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
      case "pending":
        return (
          <svg
            className="w-5 h-5 text-yellow-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      default:
        return (
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime) return null;
    const end = endTime || new Date();
    const duration = Math.floor((end - new Date(startTime)) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const statusColor = getStatusColor();
  const statusText = getStatusText();

  return (
    <div className={`bg-${statusColor}-50 border border-${statusColor}-200   p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <h3 className="text-sm font-medium text-gray-50">
              {job.type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </h3>
            <p className={`text-sm text-${statusColor}-700`}>
              {statusText}
              {job.progress !== undefined && job.progress !== null && (
                <span className="ml-2">({job.progress}%)</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {job.status === "running" && onCancel && (
            <button
              onClick={() => onCancel(job)}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-200 hover:bg-gray-200"
            >
              Annuler
            </button>
          )}
          {(job.status === "failed" || job.status === "cancelled") && onRetry && (
            <button
              onClick={() => onRetry(job)}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200"
            >
              Réessayer
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {job.progress !== undefined && job.progress !== null && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-300 mb-1">
            <span>Progression</span>
            <span>{job.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`bg-${statusColor}-500 h-2 rounded-full transition-all duration-300`}
              style={{ width: `${job.progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Details */}
      {showDetails && (
        <div className="mt-3 text-xs text-gray-300 space-y-1">
          {job.message && (
            <div>
              <strong>Message:</strong> {job.message}
            </div>
          )}
          {job.created_at && (
            <div>
              <strong>Créé:</strong> {new Date(job.created_at).toLocaleString()}
            </div>
          )}
          {job.started_at && (
            <div>
              <strong>Démarré:</strong> {new Date(job.started_at).toLocaleString()}
            </div>
          )}
          {job.completed_at && (
            <div>
              <strong>Terminé:</strong> {new Date(job.completed_at).toLocaleString()}
            </div>
          )}
          {job.started_at && (
            <div>
              <strong>Durée:</strong> {formatDuration(job.started_at, job.completed_at)}
            </div>
          )}
          {job.error_details && (
            <div className="text-red-600">
              <strong>Erreur:</strong> {JSON.stringify(job.error_details, null, 2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
