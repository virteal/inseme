// src/package/inseme/components/MobileControls.jsx
import React, { useState } from 'react';
import { Hand, Mic, MessageSquare, LogOut, Check, X, Ban, MoreHorizontal } from 'lucide-react';

export function MobileControls({ onParole, onVote, onDelegate, onToggleMic, isRecording, sessionStatus }) {
    const [showVotes, setShowVotes] = useState(false);
    const [showDelegate, setShowDelegate] = useState(false);
    const [delegateTarget, setDelegateTarget] = useState('');

    if (sessionStatus === 'closed') {
        return (
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-neutral-900/90 backdrop-blur-xl border-t border-white/10 px-4 py-4 pb-8 z-50 text-center">
                <p className="text-[10px] uppercase font-bold tracking-widest text-white/30 mb-2">La séance est close</p>
                <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-white/10" />
                    <span className="text-xs text-white/50">En attente d'ouverture...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0a0c]/90 backdrop-blur-2xl border-t border-white/10 px-4 py-3 pb-8 z-50 animate-in slide-in-from-bottom-5">
            {showVotes ? (
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => { onVote('yes'); setShowVotes(false); }}
                        className="p-4 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl flex flex-col items-center gap-1 active:scale-95 transition-transform"
                    >
                        <Check className="w-6 h-6" />
                        <span className="text-[10px] font-bold uppercase">Pour</span>
                    </button>
                    <button
                        onClick={() => { onVote('no'); setShowVotes(false); }}
                        className="p-4 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl flex flex-col items-center gap-1 active:scale-95 transition-transform"
                    >
                        <X className="w-6 h-6" />
                        <span className="text-[10px] font-bold uppercase">Contre</span>
                    </button>
                    <button
                        onClick={() => { onVote('blank'); setShowVotes(false); }}
                        className="p-4 bg-white/5 text-white/60 border border-white/10 rounded-xl flex flex-col items-center gap-1 active:scale-95 transition-transform"
                    >
                        <Ban className="w-6 h-6" />
                        <span className="text-[10px] font-bold uppercase">Blanc</span>
                    </button>
                    <button
                        onClick={() => setShowVotes(false)}
                        className="col-span-3 mt-2 py-2 text-xs text-white/30 font-medium text-center"
                    >
                        Annuler
                    </button>
                </div>
            ) : showDelegate ? (
                <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-white/30 px-1">Déléguer à :</label>
                        <input
                            type="text"
                            value={delegateTarget}
                            onChange={(e) => setDelegateTarget(e.target.value)}
                            placeholder="Nom du délégué..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setShowDelegate(false)}
                            className="p-3 bg-white/5 text-white/40 rounded-xl text-xs font-bold uppercase"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={() => { onDelegate(delegateTarget); setShowDelegate(false); }}
                            className="p-3 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase"
                        >
                            Confirmer
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between gap-3">
                    <button
                        onClick={onParole}
                        className="flex-1 p-3 bg-white/5 hover:bg-white/10 rounded-xl flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors active:scale-95"
                    >
                        <Hand className="w-5 h-5" />
                        <span className="text-[9px] font-medium uppercase tracking-tighter">Parole</span>
                    </button>

                    <button
                        onClick={() => setShowVotes(true)}
                        className="flex-1 p-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl flex flex-col items-center gap-1 text-white shadow-lg shadow-indigo-500/20 active:scale-95 transition-transform"
                    >
                        <Check className="w-5 h-5" />
                        <span className="text-[9px] font-bold uppercase tracking-tighter">Voter</span>
                    </button>

                    <button
                        onClick={onToggleMic}
                        className={`flex-1 p-3 rounded-xl flex flex-col items-center gap-1 transition-colors active:scale-95 ${isRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-white/5 text-white/60 hover:text-white'}`}
                    >
                        <Mic className="w-5 h-5" />
                        <span className="text-[9px] font-medium uppercase tracking-tighter">{isRecording ? 'Direct' : 'Parler'}</span>
                    </button>

                    <button
                        onClick={() => setShowDelegate(true)}
                        className="flex-1 p-3 bg-white/5 hover:bg-white/10 rounded-xl flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors active:scale-95"
                    >
                        <LogOut className="w-5 h-5 rotate-180" />
                        <span className="text-[9px] font-medium uppercase tracking-tighter">Bye</span>
                    </button>
                </div>
            )}
        </div>
    );
}
