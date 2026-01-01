import React from "react";
import { Mic, Square, Loader2, Volume2, Bot, Sparkles } from "lucide-react";

export function TalkButton({
  vocalState,
  isRecording,
  isTranscribing,
  startRecording,
  stopRecording,
  isHandsFree,
  className = "",
  size = "md", // sm, md, lg
  showLabel = true,
}) {
  // Determine current visual state
  let state = "idle";
  if (isTranscribing) state = "thinking";
  else if (isRecording) state = "recording";
  else if (vocalState === "speaking") state = "speaking";
  else if (vocalState === "thinking") state = "thinking";

  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-14 h-14",
    lg: "w-20 h-20",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-10 h-10",
  };

  const getStyles = () => {
    switch (state) {
      case "recording":
        return "bg-red-500 text-white shadow-lg shadow-red-500/40 animate-pulse border-red-400";
      case "thinking":
        return "bg-indigo-500 text-white shadow-lg shadow-indigo-500/40 border-indigo-400";
      case "speaking":
        return "bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 border-emerald-400";
      default:
        return "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border-white/10";
    }
  };

  const getLabel = () => {
    switch (state) {
      case "recording":
        return "Écoute...";
      case "thinking":
        return "Analyse...";
      case "speaking":
        return "Ophélia parle";
      default:
        return isHandsFree ? "Mains libres" : "Parler";
    }
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => (isRecording ? stopRecording() : startRecording())}
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center transition-all active:scale-95 border-2 group relative cursor-pointer ${getStyles()}`}
        title={isRecording ? "Arrêter l'enregistrement" : "Cliquer pour parler"}
      >
        {/* Outer Ring Animation for active states */}
        {(state === "recording" || state === "speaking") && (
          <div className="absolute inset-0 rounded-full bg-current opacity-20 animate-ping" />
        )}

        <div className="relative z-10">
          {state === "idle" && <Mic className={iconSizes[size]} />}
          {state === "recording" && (
            <Square className={`${iconSizes[size]} fill-current`} />
          )}
          {state === "thinking" && (
            <Sparkles className={`${iconSizes[size]} animate-pulse`} />
          )}
          {state === "speaking" && <Volume2 className={iconSizes[size]} />}
        </div>
      </button>
      {showLabel && (
        <span className="text-[9px] font-black uppercase tracking-widest text-white/40 transition-colors group-hover:text-white/60">
          {getLabel()}
        </span>
      )}
    </div>
  );
}
