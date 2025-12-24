import React, { useState } from "react";
import { getSupabase } from "../../lib/supabase";

export default function VoteButton({ propositionId, userId, currentVote, onVoteChange }) {
  const [loading, setLoading] = useState(false);

  const options = [
    {
      value: "approve",
      label: "Pour",
      color: "green",
      displayClass: "bg-green-600 text-white",
      hoverClass: "bg-green-100 text-green-700 hover:bg-green-200",
    },
    {
      value: "neutral",
      label: "Neutre",
      color: "gray",
      displayClass: "bg-gray-600 text-white",
      hoverClass: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    },
    {
      value: "disapprove",
      label: "Contre",
      color: "red",
      displayClass: "bg-red-600 text-white",
      hoverClass: "bg-red-100 text-red-700 hover:bg-red-200",
    },
    {
      value: "false_choice",
      label: "Faux Dilemme",
      color: "purple",
      displayClass: "bg-purple-600 text-white",
      hoverClass: "bg-purple-100 text-purple-700 hover:bg-purple-200",
    },
  ];

  const [showRefusalOptions, setShowRefusalOptions] = useState(false);

  const refusalReasons = [
    { value: "biased", label: "Biaisée" },
    { value: "incomplete", label: "Incomplète" },
    { value: "ambiguous", label: "Ambiguë" },
    { value: "other", label: "Autre" },
  ];

  const handleVote = async (voteValue, metadata = {}) => {
    setLoading(true);
    setShowRefusalOptions(false); // Reset UI

    try {
      if (currentVote) {
        // Toggle off if clicking same value
        if (currentVote.vote_value === voteValue) {
          // Special case: If toggling off False Choice, just delete.
          // If clicking False Choice again to change reason, it's an update.
          // However, simple alignment: click same button = remove.
          await getSupabase().from("votes").delete().eq("id", currentVote.id);
        } else {
          // Update existing
          await getSupabase()
            .from("votes")
            .update({
              vote_value: voteValue,
              metadata: metadata, // Save reason if present
              updated_at: new Date().toISOString(),
            })
            .eq("id", currentVote.id);
        }
      } else {
        // New vote
        await getSupabase().from("votes").insert({
          user_id: userId,
          proposition_id: propositionId,
          vote_value: voteValue,
          metadata: metadata,
        });
      }

      onVoteChange();
    } catch (error) {
      console.error("Erreur lors du vote:", error);
    } finally {
      setLoading(false);
    }
  };

  const onOptionClick = (opt) => {
    if (opt.value === "false_choice") {
      // If already selected, regular toggle logic (which leads to delete)
      if (currentVote?.vote_value === "false_choice") {
        handleVote("false_choice");
      } else {
        // Show options to qualify
        setShowRefusalOptions(!showRefusalOptions);
      }
    } else {
      handleVote(opt.value);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onOptionClick(opt)}
            disabled={loading}
            className={`flex-1 min-w-[100px] py-2 px-3 text-sm font-semibold transition-colors disabled:opacity-50 rounded shadow-sm ${
              currentVote?.vote_value === opt.value ? opt.displayClass : opt.hoverClass
            }`}
            title={opt.value === "false_choice" ? "Je refuse les termes de la question" : ""}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {showRefusalOptions && (
        <div className="bg-purple-50 p-2 rounded border border-purple-200 animate-in fade-in slide-in-from-top-2">
          <p className="text-xs text-purple-800 mb-2 font-semibold">
            Pourquoi refusez-vous ce choix ?
          </p>
          <div className="flex flex-wrap gap-2">
            {refusalReasons.map((reason) => (
              <button
                key={reason.value}
                onClick={() => handleVote("false_choice", { refusal_reason: reason.value })}
                className="text-xs px-2 py-1 bg-white border border-purple-200 text-purple-700 hover:bg-purple-100 rounded"
              >
                {reason.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
