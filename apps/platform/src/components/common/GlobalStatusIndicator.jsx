import React from "react";
import { useGlobalStatus } from "../../contexts/GlobalStatusContext";
import { useSupabase } from "../../contexts/SupabaseContext";

/**
 * Global status indicator component
 * Shows overall app status and active operations
 */
export default function GlobalStatusIndicator() {
  const { status, message } = useGlobalStatus();
  const { connectionState } = useSupabase();

  // Return null only if everything is fine (idle status, no message, and connected)
  if (status === "idle" && !message && connectionState === "connected") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pointer-events-none select-none">
      <div className="w-full max-w-sm mt-6 pointer-events-auto drop-shadow-xl relative">
        {status && status !== "idle" && (
          <div
            className={`  p-3 mb-2 shadow-lg border ${status === "error" ? "bg-red-100 border-red-300 text-red-800" : status === "loading" ? "bg-blue-100 border-blue-300 text-blue-800" : "bg-green-100 border-green-300 text-green-800"}`}
          >
            <span className="font-medium text-sm">
              {status === "loading" && "Chargement..."}
              {status === "error" && "Erreur"}
              {status === "success" && "Succès"}
              {status === "idle" && "Info"}
            </span>
            {message && <div className="text-xs mt-1">{message}</div>}
          </div>
        )}

        {/* Connection Status Indicator */}
        {connectionState !== "connected" && (
          <div
            className={`  p-3 mb-2 shadow-lg border ${connectionState === "error" ? "bg-red-100 border-red-300 text-red-800" : "bg-yellow-100 border-yellow-300 text-yellow-800"}`}
          >
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="font-medium text-sm">
                {connectionState === "connecting" && "Connexion en cours..."}
                {connectionState === "reconnecting" && "Reconnexion..."}
                {connectionState === "disconnected" && "Déconnecté"}
                {connectionState === "error" && "Erreur de connexion"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
