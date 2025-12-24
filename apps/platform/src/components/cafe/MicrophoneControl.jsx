import React from "react";
import { useCafeSession } from "../../contexts/CafeSessionContext";
import { Microphone, HandPalm, HourglassMedium, Record } from "@phosphor-icons/react";

import { useEffect } from "react";

const MicrophoneControl = () => {
  const { micState, requestMic, releaseMic, currentUser } = useCafeSession();

  useEffect(() => {
    // Écoute l'événement personnalisé pour libérer le micro
    const handler = () => {
      if (micState !== "off") releaseMic();
    };
    window.addEventListener("release-mic", handler);
    return () => window.removeEventListener("release-mic", handler);
  }, [micState, releaseMic]);

  if (!currentUser) return <div className="text-gray-500">Rejoignez la session pour parler.</div>;

  const handleMainClick = () => {
    if (micState === "off") {
      requestMic();
    } else if (micState === "focused" || micState === "recording") {
      releaseMic();
    } else if (micState === "requesting") {
      // maybe cancel request?
      releaseMic();
    }
  };

  let colorClass = "bg-gray-200 text-gray-600 hover:bg-gray-300";
  let Icon = Microphone;
  let label = "Demander la parole";
  let subline = "";

  if (micState === "requesting") {
    colorClass = "bg-yellow-100 text-yellow-700 animate-pulse";
    Icon = HandPalm;
    label = "Demande envoyée...";
    subline = "L'hôte va vous donner la parole.";
  } else if (micState === "queued") {
    colorClass = "bg-blue-100 text-blue-700";
    Icon = HourglassMedium;
    label = "En file d'attente";
    subline = "Préparez-vous.";
  } else if (micState === "focused") {
    colorClass = "bg-green-500 text-white shadow-lg scale-105 transition-transform";
    Icon = Microphone;
    label = "C'est à vous !";
    subline = "Appuyez pour terminer";
  } else if (micState === "recording") {
    colorClass = "bg-red-500 text-white animate-pulse shadow-xl ring-4 ring-red-200";
    Icon = Record;
    label = "Enregistrement...";
    subline = "Parlez maintenant";
  }

  return (
    <div className="flex flex-col items-center justify-center transition-all duration-300">
      <div className="relative">
        {/* Ripples for active states */}
        {(micState === "focused" || micState === "recording" || micState === "requesting") && (
          <span
            className={`absolute inset-0 rounded-full animate-ping opacity-20 ${colorClass.split(" ")[0]}`}
          ></span>
        )}

        <button
          onClick={handleMainClick}
          className={`w-28 h-28 md:w-32 md:h-32 rounded-full flex flex-col items-center justify-center ${colorClass} transition-all duration-500 shadow-xl focus:outline-none active:scale-95 border-4 border-white`}
          style={{ backgroundSize: "200% 200%" }} // Prepare for gradients
        >
          <Icon size={40} weight="fill" className="drop-shadow-sm" />
        </button>
      </div>

      <div className="mt-3 text-center">
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">{label}</h3>
        {subline && <p className="text-xs text-gray-500 font-medium">{subline}</p>}
      </div>
    </div>
  );
};

export default MicrophoneControl;
