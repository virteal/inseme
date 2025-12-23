import React, { useState } from 'react';
import { CheckCircle2, XCircle, HelpCircle, AlertTriangle, MessageSquare, ChevronRight, Settings } from 'lucide-react';
import { useInsemeContext } from '../InsemeContext';

export function VoteButtons(props) {
    const context = useInsemeContext();
    const { castVote, setMedia, setProposition, resetVotes } = { ...context, ...props };

    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const mainButtons = [
        { id: 'ok', label: 'D\'accord', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20', icon: CheckCircle2 },
        { id: 'no', label: 'Pas d\'accord', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20', icon: XCircle },
        { id: 'off', label: 'Besoin d\'air', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20', icon: HelpCircle },
        { id: 'parole', label: 'Demande de parole', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20', icon: MessageSquare },
        { id: 'technical', label: 'Point technique', color: 'bg-orange-600/10 text-orange-400 border-orange-600/20 hover:bg-orange-600/20', icon: AlertTriangle }
    ];

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {mainButtons.map(btn => (
                    <button
                        key={btn.id}
                        onClick={() => castVote?.(btn.id)}
                        className={`flex flex-col items-center justify-center gap-3 p-5 rounded-3xl border transition-all active:scale-95 group ${btn.color}`}
                    >
                        <btn.icon className="w-8 h-8 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-center leading-tight">{btn.label}</span>
                    </button>
                ))}
            </div>

            {/* Admin/Relay Quick Actions (Expandable) */}
            <div className="relative">
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="flex items-center gap-2 text-[10px] font-black text-white/20 uppercase tracking-[0.2em] hover:text-white/40 transition-colors px-2 py-1"
                >
                    <Settings className={`w-3 h-3 transition-transform ${isMenuOpen ? 'rotate-90' : ''}`} />
                    Actions Relais
                </button>

                {isMenuOpen && (
                    <div className="flex flex-wrap gap-2 mt-3 p-4 bg-white/5 rounded-2xl border border-white/5 animate-in fade-in slide-in-from-top-2">
                        <button
                            onClick={() => {
                                const p = prompt("Nouvelle proposition ?");
                                if (p) setProposition?.(p);
                            }}
                            className="px-4 py-2 bg-indigo-500/20 text-indigo-300 rounded-xl text-[10px] font-bold border border-indigo-500/30 hover:bg-indigo-500/30 transition-all"
                        >
                            NOUVELLE PROPOSITION
                        </button>
                        <button
                            onClick={() => { if (confirm("Réinitialiser tous les votes ?")) resetVotes?.() }}
                            className="px-4 py-2 bg-rose-500/10 text-rose-400 rounded-xl text-[10px] font-bold border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                        >
                            RESET VOTES
                        </button>
                        <button
                            onClick={() => {
                                const url = prompt("Lien Jitsi ou YouTube ?");
                                if (url) setMedia?.('live', url);
                            }}
                            className="px-4 py-2 bg-white/5 text-white/60 rounded-xl text-[10px] font-bold border border-white/10 hover:bg-white/10 transition-all"
                        >
                            MODIFIER LIVE
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
