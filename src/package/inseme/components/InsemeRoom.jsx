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
export function InsemeRoom({ roomName, user, supabase, config = {}, slots = {} }) {
    const ChatComponent = slots.Chat || Chat;
    const ResultsComponent = slots.Results || Results;
    const VoteButtonsComponent = slots.VoteButtons || VoteButtons;
    const MediaLayerComponent = slots.MediaLayer || ModernMediaLayer;

    return (
        <InsemeProvider roomName={roomName} user={user} supabase={supabase} config={config}>
            <div className="min-h-screen bg-[#0a0a0c] text-white selection:bg-indigo-500/30">
                <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
                    {/* Dynamic Media Layer (Jitsi / YouTube / Pad / etc.) */}
                    <MediaLayerComponent />

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                        {/* Discussion Column */}
                        <div className="xl:col-span-5 relative">
                            <ChatComponent />
                        </div>

                        {/* Interactive Board Column */}
                        <div className="xl:col-span-7 space-y-8">
                            <VoteButtonsComponent />
                            <ResultsComponent />
                        </div>
                    </div>
                </div>
            </div>
        </InsemeProvider>
    );
}
