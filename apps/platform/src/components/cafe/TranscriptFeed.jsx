import React, { useEffect, useRef } from "react";
import { useCafeSession } from "../../contexts/CafeSessionContext";

const TranscriptFeed = () => {
  const { utterances, participants } = useCafeSession();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [utterances]);

  const getParticipantName = (id) => {
    const p = participants.find((x) => x.id === id);
    return p ? p.display_handle : "Inconnu";
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[60vh] bg-slate-50 rounded-lg shadow-inner">
      {utterances.length === 0 && (
        <div className="text-center text-gray-400 italic py-10">
          La discussion n'a pas encore commencé.
        </div>
      )}

      {utterances.map((u) => {
        const isMsg = u.speech_type === "text_message";
        return (
          <div
            key={u.id}
            className={`flex flex-col ${u.speaker_type === "ophelia" ? "items-start" : "items-end"}`}
          >
            <div
              className={`max-w-[80%] rounded-xl p-3 shadow-sm ${
                u.speaker_type === "ophelia"
                  ? "bg-purple-100 text-purple-900 rounded-tl-none"
                  : isMsg
                    ? "bg-blue-50 text-blue-900 border border-blue-200 rounded-tr-none"
                    : "bg-white text-gray-800 rounded-tr-none border border-gray-100"
              }`}
            >
              <div className="text-xs font-bold mb-1 opacity-70 flex justify-between gap-4">
                <span>
                  {u.speaker_type === "ophelia"
                    ? "👁️ Ophélia"
                    : getParticipantName(u.participant_id)}
                  {isMsg && " 💬"}
                </span>
                <span>
                  {new Date(u.created_at || Date.now()).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="whitespace-pre-wrap">{u.clean_transcript || u.raw_transcript}</p>
              {u.is_important && !isMsg && (
                <div className="mt-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded inline-block">
                  ✨ Point clé
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};

export default TranscriptFeed;
