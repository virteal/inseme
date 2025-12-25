import React, { useState, useEffect } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';

export function ModernMediaLayer({ media }) {
    if (!media) return null;

    const { type, url } = media;

    // Jitsi Integration
    if (type === 'live' && (url.includes('meet.jit.si') || url.startsWith('jitsi:'))) {
        const roomName = url.split('/').pop();
        return (
            <div className="w-full h-[600px] rounded-xl overflow-hidden shadow-2xl bg-neutral-900 mb-6">
                <JitsiMeeting
                    domain="meet.jit.si"
                    roomName={roomName}
                    configOverwrite={{
                        startWithAudioMuted: true,
                        disableModeratorIndicator: true,
                        startScreenSharing: false,
                        enableEmailInStats: false
                    }}
                    interfaceConfigOverwrite={{
                        DISABLE_JOIN_LEAVE_NOTIFICATIONS: true
                    }}
                    userInfo={{
                        displayName: 'Inseme Participant',
                    }}
                    onApiReady={(externalApi) => {
                        // Handle Jitsi API
                    }}
                    getIFrameRef={(iframeRef) => {
                        iframeRef.style.height = '100%';
                    }}
                />
            </div>
        );
    }

    // Classic YouTube/Embeds
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = url.split('v=')[1] || url.split('/').pop();
        if (videoId.includes('&')) videoId = videoId.split('&')[0];

        return (
            <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl mb-6">
                <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                ></iframe>
            </div>
        );
    }

    // Pads (Framapad, etc.)
    if (type === 'pad') {
        return (
            <div className="w-full h-[600px] rounded-xl overflow-hidden shadow-2xl bg-white mb-6">
                <iframe
                    className="w-full h-full"
                    src={url.startsWith('http') ? url : `https://framapad.org/p/${url}`}
                    title="Collaborative Pad"
                ></iframe>
            </div>
        );
    }

    // Images
    if (type === 'image') {
        return (
            <div className="w-full center mb-6">
                <img src={url} alt="Shared content" className="max-w-full rounded-xl shadow-xl border-4 border-white" />
            </div>
        );
    }

    // Default: Generic iframe or Link
    return (
        <div className="w-full p-4 bg-white/10 rounded-xl border border-white/20 backdrop-blur-sm mb-6 text-center">
            <p className="text-white/60 mb-2">Contenu externe : {type}</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline font-medium">
                {url}
            </a>
        </div>
    );
}
