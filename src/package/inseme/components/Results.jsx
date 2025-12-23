import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Users, Clock, Info, CheckCircle2, XCircle, HelpCircle, AlertTriangle, MessageSquare } from 'lucide-react';
import { useInsemeContext } from '../InsemeContext';

export function Results(props) {
    const context = useInsemeContext();
    const { roomData } = { ...context, ...props };
    const { proposition, results, votes, speechQueue } = roomData || { proposition: '', results: {}, votes: {}, speechQueue: [] };

    const voteChoices = [
        { id: 'ok', label: 'D\'accord', color: 'bg-emerald-500', icon: CheckCircle2, text: 'text-emerald-400' },
        { id: 'no', label: 'Pas d\'accord', color: 'bg-rose-500', icon: XCircle, text: 'text-rose-400' },
        { id: 'off', label: 'Besoin d\'air', color: 'bg-sky-500', icon: HelpCircle, text: 'text-sky-400' },
        { id: 'parole', label: 'Demande de parole', color: 'bg-amber-500', icon: MessageSquare, text: 'text-amber-400' },
        { id: 'technical', label: 'Point technique', color: 'bg-orange-600', icon: AlertTriangle, text: 'text-orange-400' }
    ];

    return (
        <div className="space-y-8">
            {/* Proposition Card */}
            <div className="bg-neutral-900/40 backdrop-blur-3xl rounded-3xl border border-white/[0.08] p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-blue-600"></div>

                <div className="flex items-start gap-6">
                    <div className="p-3.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 group-hover:scale-105 transition-transform">
                        <Info className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.2em]">
                                Proposition Active
                            </span>
                            <div className="flex items-center gap-2 px-2 py-0.5 rounded-md bg-white/5 border border-white/5">
                                <Users className="w-3 h-3 text-white/40" />
                                <span className="text-[10px] font-bold text-white/60">{Object.keys(votes || {}).length} Participants</span>
                            </div>
                        </div>
                        <div className="text-2xl text-white/95 font-semibold prose prose-invert prose-p:leading-relaxed max-w-none prose-strong:text-indigo-300 prose-em:text-indigo-200">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {proposition}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>

                {/* Live Results Bar */}
                {results && Object.keys(results).length > 0 && (
                    <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {voteChoices.map(choice => {
                            const count = results[choice.id] || 0;
                            const percentage = Math.round((count / Object.keys(votes || {}).length) * 100) || 0;

                            return (
                                <div key={choice.id} className={`flex flex-col gap-1 p-3 rounded-2xl bg-white/5 border border-white/5 ${count > 0 ? 'opacity-100' : 'opacity-20'}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <choice.icon className={`w-3 h-3 ${choice.text}`} />
                                        <span className="text-xs font-black text-white">{count}</span>
                                    </div>
                                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                        <div className={`h-full ${choice.color} transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
                                    </div>
                                    <span className="text-[9px] font-bold text-white/30 uppercase tracking-tighter mt-1">{choice.label}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Speech Queue (Relay View) - Priority Display */}
                <div className="lg:col-span-12">
                    {speechQueue?.length > 0 ? (
                        <div className="bg-amber-500/10 backdrop-blur-2xl rounded-3xl border border-amber-500/20 p-8 border-l-8 border-l-amber-500 shadow-2xl animate-pulse-subtle">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-amber-500/20 rounded-2xl border border-amber-500/30">
                                        <MessageSquare className="w-6 h-6 text-amber-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-amber-500 uppercase tracking-widest">File d'Intervention</h3>
                                        <p className="text-[10px] text-amber-500/60 font-bold uppercase tracking-widest">Ophélia gère la médiation</p>
                                    </div>
                                </div>
                                <span className="bg-amber-500 text-black px-4 py-1.5 rounded-full font-black text-xs">
                                    {speechQueue.length} EN ATTENTE
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {speechQueue.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/10 border border-amber-500/10 hover:bg-amber-500/20 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center font-black text-sm">
                                                {i + 1}
                                            </div>
                                            <span className="font-bold text-white group-hover:text-amber-400 transition-colors">{s.name}</span>
                                        </div>
                                        <span className={`text-[10px] px-2 py-1 rounded font-black uppercase ${s.type === 'technical' ? 'bg-orange-600 text-white' : 'bg-amber-500/20 text-amber-500'}`}>
                                            {s.type === 'parole' ? 'PAROLE' : 'TECHNIQUE'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white/[0.03] rounded-3xl border border-white/[0.05] p-6 flex items-center justify-center gap-4 text-white/20">
                            <MessageSquare className="w-5 h-5 opacity-20" />
                            <span className="text-xs font-bold uppercase tracking-widest">Aucune demande de parole en attente</span>
                        </div>
                    )}
                </div>

                {/* Participants / Long Results */}
                <div className="lg:col-span-12">
                    <div className="bg-neutral-900/20 backdrop-blur-xl rounded-3xl border border-white/[0.05] p-8 shadow-xl">
                        <div className="flex items-center gap-4 mb-8">
                            <Users className="w-5 h-5 text-white/40" />
                            <h3 className="text-xl font-bold text-white tracking-tight">États de l'Assemblée</h3>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
                            {(!votes || Object.entries(votes).length === 0) ? (
                                <p className="text-white/10 text-sm italic col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-3xl font-medium">
                                    En attente des premiers votes...
                                </p>
                            ) : (
                                Object.entries(votes).map(([id, v]) => {
                                    const choice = voteChoices.find(c => c.id === v.type) || { color: 'bg-white/10', label: v.type, text: 'text-white/40' };
                                    return (
                                        <div key={id} className="group flex flex-col p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.07] hover:border-white/10 transition-all">
                                            <span className="text-xs font-bold text-white/90 truncate mb-1">
                                                {v.name}
                                            </span>
                                            <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                                                <span className={`text-[9px] font-black uppercase tracking-tighter ${choice.text}`}>
                                                    {choice.label}
                                                </span>
                                                <Clock className="w-3 h-3 text-white/10" />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
