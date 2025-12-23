import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, Loader2, Volume2, Mic } from 'lucide-react';
import { useInsemeContext } from '../InsemeContext';

export function Chat(props) {
    const context = useInsemeContext();
    const { messages, sendMessage, askOphélia, isOphéliaThinking } = { ...context, ...props };

    const [newMessage, setNewMessage] = useState('');
    const scrollRef = useRef(null);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        await sendMessage(newMessage);
        setNewMessage('');
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="flex flex-col h-[600px] bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative">
            {/* Thinking Overlay */}
            {isOphéliaThinking && (
                <div className="absolute inset-x-0 top-16 z-20 bg-indigo-500/10 border-b border-indigo-500/20 backdrop-blur-sm px-6 py-2 flex items-center gap-3 animate-pulse">
                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Ophélia analyse les débats en temps réel...</span>
                </div>
            )}

            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5 relative z-10">
                <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        Discussion
                    </h2>
                    <p className="text-[10px] text-white/30 uppercase tracking-tighter">Échanges & Médiation</p>
                </div>
                <button
                    onClick={() => askOphélia()}
                    disabled={isOphéliaThinking}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold transition-all border border-indigo-500/30 disabled:opacity-50 group"
                >
                    <Bot className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    DEMANDER À OPHÉLIA
                </button>
            </div>

            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
            >
                {messages?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-white/20 space-y-4">
                        <Bot className="w-12 h-12 opacity-10" />
                        <div className="text-center">
                            <p>Aucun message pour le moment.</p>
                            <p className="text-xs">Ophélia écoute et attend le début du débat.</p>
                        </div>
                    </div>
                ) : (
                    messages?.map((msg, i) => {
                        if (msg.message.toLowerCase().startsWith('inseme')) return null;
                        if (msg.metadata?.vocal_only) return null; // Only play audio

                        const isAI = msg.name === 'Ophélia';
                        const hasAudio = !!msg.metadata?.vocal_payload;

                        return (
                            <div key={msg.id || i} className={`flex flex-col group ${isAI ? 'items-start' : 'items-start'}`}>
                                <div className="flex items-baseline gap-2 mb-1.5 px-1">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${isAI ? 'text-indigo-400 font-bold' : 'text-white/30'}`}>
                                        {msg.name}
                                    </span>
                                    <span className="text-[9px] text-white/10 font-medium">
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {hasAudio && <Volume2 className="w-3 h-3 text-indigo-500 animate-pulse" />}
                                </div>
                                <div className={`px-4 py-3 rounded-2xl max-w-[92%] transition-all shadow-sm ${isAI
                                    ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-50 text-sm leading-relaxed'
                                    : 'bg-white/5 text-white/80 border border-white/5 text-sm leading-relaxed group-hover:bg-white/[0.07]'}`}>
                                    <div className="prose prose-invert prose-sm max-w-none prose-p:my-0 prose-headings:text-indigo-300 prose-a:text-indigo-400">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {msg.message}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="p-4 bg-neutral-900/50 backdrop-blur-xl border-t border-white/10 flex gap-3 relative z-10">
                <div className="relative flex-1 group">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Participez au débat..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all group-hover:border-white/20"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <button type="button" className="p-2 text-white/20 hover:text-white/40 transition-colors">
                            <Mic className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <button
                    type="submit"
                    className="aspect-square flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 px-4"
                >
                    <Send className="w-5 h-5" />
                </button>
            </form>
        </div>
    );
}
