import React from "react";
import { useCafeSession } from "../../contexts/CafeSessionContext";
import { Gavel, Check, X } from "@phosphor-icons/react";

const HostControls = () => {
  const { isHost, participants, controlPhase, grantMic, session } = useCafeSession();

  if (!isHost) return null;

  const requesters = participants.filter(
    (p) => p.mic_state === "requesting" || p.mic_state === "queued"
  );

  return (
    <div className="bg-gray-900 text-white rounded-xl p-4 shadow-xl border border-gray-700 mt-4 md:mt-0">
      <div className="flex items-center gap-2 mb-4 border-b border-gray-700 pb-2">
        <Gavel className="text-purple-400" size={20} />
        <h3 className="font-bold text-sm uppercase tracking-wider">Zone Hôte</h3>
      </div>

      {/* Mic Requests */}
      <div className="mb-6">
        <h4 className="text-xs text-gray-400 font-semibold mb-2">
          DEMANDES DE PAROLE ({requesters.length})
        </h4>
        {requesters.length === 0 ? (
          <div className="text-gray-500 text-sm italic">Aucune demande en attente.</div>
        ) : (
          <ul className="space-y-2">
            {requesters.map((p) => (
              <li key={p.id} className="flex items-center justify-between bg-gray-800 p-2 rounded">
                <span className="text-sm font-medium">{p.display_handle}</span>
                <button
                  onClick={() => grantMic(p.id)}
                  className="bg-green-600 hover:bg-green-500 text-white p-1 rounded-full"
                >
                  <Check size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Phase Control */}
      <div>
        <h4 className="text-xs text-gray-400 font-semibold mb-2">PHASE ACTUELLE</h4>
        <div className="text-lg font-bold text-purple-300 capitalize mb-3">
          {session?.current_phase || "Non structuré"}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => controlPhase("set", "exploration")}
            className={`px-3 py-1 rounded text-xs font-bold ${session?.current_phase === "exploration" ? "bg-purple-600" : "bg-gray-700 hover:bg-gray-600"}`}
          >
            Exploration
          </button>
          <button
            onClick={() => controlPhase("set", "cristallisation")}
            className={`px-3 py-1 rounded text-xs font-bold ${session?.current_phase === "cristallisation" ? "bg-purple-600" : "bg-gray-700 hover:bg-gray-600"}`}
          >
            Cristallisation
          </button>
          <button
            onClick={() => controlPhase("set", "formalisation")}
            className={`px-3 py-1 rounded text-xs font-bold ${session?.current_phase === "formalisation" ? "bg-purple-600" : "bg-gray-700 hover:bg-gray-600"}`}
          >
            Formalisation
          </button>
          <button
            onClick={() => controlPhase("set", "cloture")}
            className={`px-3 py-1 rounded text-xs font-bold ${session?.current_phase === "cloture" ? "bg-purple-600" : "bg-gray-700 hover:bg-gray-600"}`}
          >
            Clôture
          </button>
        </div>
      </div>
    </div>
  );
};

export default HostControls;
