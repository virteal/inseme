import React from 'react';
import { InsemeProvider } from '../InsemeContext';
import { Chat } from './Chat';
import { Results } from './Results';
import { VoteButtons } from './VoteButtons';
import { ModernMediaLayer } from './ModernMediaLayer';

/**
 * InsemeRoom - The all-in-one assembly room component.
 * 
 * @param {string} roomName - The unique ID of the room.
 * @param {object} user - The current Supabase user.
 * @param {object} supabase - The Supabase client instance.
 * @param {object} config - Configuration object (jitsi, ophelia, prompts).
 * @param {object} slots - Custom component overrides { Chat, Results, VoteButtons, MediaLayer }.
 */
export function InsemeRoom({ roomName, user, supabase, config = {}, slots = {}, isSpectator = false }) {
    const ChatComponent = slots.Chat || Chat;
    const ResultsComponent = slots.Results || Results;
    const VoteButtonsComponent = slots.VoteButtons || VoteButtons;
    const MediaLayerComponent = slots.MediaLayer || ModernMediaLayer;

    const [isBoardOpen, setIsBoardOpen] = React.useState(true);

    return (
        <InsemeProvider roomName={roomName} user={user} supabase={supabase} config={config} isSpectator={isSpectator}>
            <div className="min-h-screen bg-[#0a0a0c] text-white selection:bg-indigo-500/30 overflow-x-hidden">
                <div className="max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col h-screen">
                    
                    {/* Media Layer (Fixed ratio or collapsed) */}
                    <div className="shrink-0 mb-4 lg:mb-6">
                        <MediaLayerComponent />
                    </div>

                    <div className="flex-1 flex flex-col lg:flex-row gap-6 lg:gap-8 min-h-0 relative">
                        
                        {/* Discussion Column (Primary) */}
                        <div className={`flex-1 flex flex-col min-h-0 transition-all duration-500 ease-in-out ${isBoardOpen ? 'lg:w-2/3' : 'lg:w-full'}`}>
                            <ChatComponent onToggleBoard={() => setIsBoardOpen(!isBoardOpen)} isBoardOpen={isBoardOpen} />
                        </div>

                        {/* Interactive Board (Collapsible) */}
                        <div className={`
                            fixed inset-y-0 right-0 z-40 w-full sm:w-[400px] lg:relative lg:w-[400px] lg:z-0
                            transform transition-all duration-500 ease-in-out bg-[#0f0f12]/95 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none
                            ${isBoardOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 lg:hidden'}
                        `}>
                            <div className="h-full flex flex-col p-6 lg:p-0 space-y-6 overflow-y-auto custom-scrollbar">
                                <div className="flex items-center justify-between lg:hidden mb-4">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-white/40">Tableau de Bord</h3>
                                    <button onClick={() => setIsBoardOpen(false)} className="p-2 rounded-xl bg-white/5 text-white/60 hover:text-white">Fermer</button>
                                </div>
                                <VoteButtonsComponent />
                                <ResultsComponent />
                            </div>
                        </div>

                        {/* Mobile Floating Toggle for Board */}
                        {!isBoardOpen && (
                            <button 
                                onClick={() => setIsBoardOpen(true)}
                                className="fixed bottom-24 right-6 z-50 p-4 rounded-full bg-indigo-500 shadow-2xl shadow-indigo-500/50 text-white lg:flex hidden items-center gap-2 animate-in fade-in slide-in-from-right-4"
                            >
                                <BarChart3 className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-widest">Tableau</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </InsemeProvider>
    );
}
