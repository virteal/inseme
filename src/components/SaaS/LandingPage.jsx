import React, { useState } from 'react';
import { submitLead } from '../lib/leads';
import { ArrowRight, Bot, Users, Vote, Shield, MessageSquare, Sparkles } from 'lucide-react';

export function LandingPage({ onLogin }) {
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const { success } = await submitLead({ email });
        setIsSubmitting(false);
        if (success) {
            setIsSuccess(true);
            setEmail('');
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0c] text-white selection:bg-indigo-500/30 selection:text-indigo-200">
            {/* Nav */}
            <nav className="fixed top-0 w-full z-50 px-8 py-6 flex justify-between items-center backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-black italic">I</div>
                    <span className="text-xl font-black tracking-tighter">INSEME</span>
                </div>
                <button
                    onClick={onLogin}
                    className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all font-bold text-sm"
                >
                    ACCÈS MEMBRE
                </button>
            </nav>

            {/* Hero */}
            <div className="relative pt-40 pb-20 px-4 overflow-hidden">
                {/* Background Blobs */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] -z-10 rounded-full animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-[700px] h-[700px] bg-rose-600/5 blur-[180px] -z-10 rounded-full"></div>

                <div className="max-w-5xl mx-auto text-center space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-bold tracking-widest uppercase">
                        <Sparkles className="w-3 h-3" />
                        Démocratie Liquide v3.0
                    </div>

                    <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-[0.8] text-white">
                        L’ASSEMBLÉE<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-600">AUGMENTÉE.</span>
                    </h1>

                    <p className="text-xl md:text-2xl text-white/50 max-w-2xl mx-auto font-medium leading-relaxed">
                        Inseme transforme vos débats en décisions collectives fluides, propulsées par une IA médiatrice et le vote liquide.
                    </p>

                    <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-8">
                        <button
                            onClick={onLogin}
                            className="w-full md:w-auto px-10 py-5 bg-white text-black text-lg font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-indigo-50 transition-all active:scale-95 shadow-2xl shadow-white/10"
                        >
                            DÉCOUVRIR L'ASSEMBLÉE
                            <ArrowRight className="w-5 h-5" />
                        </button>

                        <div className="w-full md:w-auto group">
                            <form onSubmit={handleSubmit} className="flex gap-2 p-1.5 bg-white/5 border border-white/10 rounded-2xl focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
                                <input
                                    type="email"
                                    required
                                    placeholder="Lancez votre propre instance..."
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="bg-transparent px-4 py-3 outline-none w-full md:w-64 text-sm font-medium"
                                />
                                <button
                                    disabled={isSubmitting || isSuccess}
                                    className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-white/10 disabled:text-white/40 text-white rounded-xl font-bold transition-all text-sm whitespace-nowrap"
                                >
                                    {isSuccess ? 'REÇU !' : (isSubmitting ? '...' : 'DEMANDER L\'ESSAI')}
                                </button>
                            </form>
                            {isSuccess && <p className="text-[10px] text-indigo-400 font-bold mt-2 uppercase tracking-widest text-center">On vous recontacte très vite.</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Preview */}
            <div className="max-w-7xl mx-auto px-8 py-40 grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="space-y-6 group">
                    <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center group-hover:border-indigo-500/50 group-hover:bg-indigo-500/10 transition-all duration-500">
                        <Bot className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h3 className="text-2xl font-black tracking-tight">Ophélia AI</h3>
                    <p className="text-white/40 leading-relaxed font-medium">Une IA médiatrice qui gère la file d'attente, résume les débats et facilite le consensus en temps réel.</p>
                </div>
                <div className="space-y-6 group">
                    <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center group-hover:border-indigo-500/50 group-hover:bg-indigo-500/10 transition-all duration-500">
                        <Vote className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h3 className="text-2xl font-black tracking-tight">Vote Liquide</h3>
                    <p className="text-white/40 leading-relaxed font-medium">La puissance de la démocratie déléguée. Transférez votre voix à des experts thématiques en un clic.</p>
                </div>
                <div className="space-y-6 group">
                    <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center group-hover:border-indigo-500/50 group-hover:bg-indigo-500/10 transition-all duration-500">
                        <Shield className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h3 className="text-2xl font-black tracking-tight">Souveraineté SaaS</h3>
                    <p className="text-white/40 leading-relaxed font-medium">Instance dédiée ou plateforme partagée. Gardez le contrôle total sur vos données et votre agora.</p>
                </div>
            </div>

            {/* Footer */}
            <footer className="px-8 py-20 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 text-white/20 font-bold uppercase tracking-widest text-[10px]">
                <p>© 2025 INSEME LABS — MADE IN CORSICA</p>
                <div className="flex gap-8">
                    <a href="#" className="hover:text-white transition-colors">Documentation</a>
                    <a href="#" className="hover:text-white transition-colors">Privacy</a>
                    <a href="#" className="hover:text-white transition-colors">Twitter</a>
                </div>
            </footer>
        </div>
    );
}
