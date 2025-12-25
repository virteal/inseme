// 

import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { AuthModal } from './package/inseme/components/AuthModal'
import { InsemeRoom } from './package/inseme'
import { SaaSDashboard } from './components/SaaS/SaaSDashboard'
import { LandingPage } from './components/SaaS/LandingPage'
import { Layout, Play, LogOut, UserCheck } from 'lucide-react'

function App() {
    const [user, setUser] = useState(null)
    const [roomName, setRoomName] = useState('Général')
    const [showAuth, setShowAuth] = useState(false)
    const [view, setView] = useState('landing') // 'landing', 'dashboard', 'participation'
    const [isSpectator, setIsSpectator] = useState(false)
    const [showGuestReconnect, setShowGuestReconnect] = useState(false)
    const [authInitialMode, setAuthInitialMode] = useState(null)

    useEffect(() => {
        const handleOpenAuth = () => setShowAuth(true);
        window.addEventListener('inseme-open-auth', handleOpenAuth);
        
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            const currentUser = session?.user ?? null
            setUser(currentUser)

            // Determine initial view
            const params = new URLSearchParams(window.location.search)
            const room = params.get('room')
            
            if (currentUser?.is_anonymous) {
                // Check if we are in "public" mode or if it's a returning session
                const isPublicMode = localStorage.getItem('inseme_is_public') === 'true'
                
                // If public mode OR if it's a restored session (not just created)
                // We show the reconnection prompt for safety
                setShowGuestReconnect(true)
            }

            if (room) {
                setRoomName(room)
                setView('participation')
                // If no user, default to spectator mode
                if (!currentUser) {
                    setIsSpectator(true)
                }
            } else if (currentUser) {
                setRoomName('Général')
                setView('dashboard')
            } else {
                setRoomName('Général')
                setView('landing')
            }
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user ?? null
            setUser(currentUser)
            if (currentUser) {
                setIsSpectator(false) // Reset spectator if logged in
                if (view === 'landing') {
                    // Anonymous guests go straight to the room, members go to dashboard
                    if (currentUser.is_anonymous) {
                        setView('participation')
                    } else {
                        setView('dashboard')
                    }
                }
            } else {
                setView('landing')
            }
        })

        return () => {
            subscription.unsubscribe();
            window.removeEventListener('inseme-open-auth', handleOpenAuth);
        };
    }, [])

    const handleSelectRoom = (slug) => {
        setRoomName(slug)
        setView('participation')
        const url = new URL(window.location)
        url.searchParams.set('room', slug)
        window.history.pushState({}, '', url)
    }

    const handleSpectator = () => {
        setIsSpectator(true)
        setShowAuth(false)
        setView('participation')
    }

    if ((!user || user.is_anonymous) && showAuth) {
        return <AuthModal 
            onClose={() => {
                setShowAuth(false)
                setAuthInitialMode(null)
            }} 
            roomName={roomName} 
            isUpgrading={!!user?.is_anonymous} 
            onSpectator={handleSpectator}
            initialMode={authInitialMode}
        />
    }

    // --- RENDER MODES ---

    // 1. Landing Page (Public)
    if (view === 'landing') {
        return <LandingPage onLogin={() => {
            setAuthInitialMode('signin')
            setShowAuth(true)
        }} />
    }

    return (
        <div className="min-h-screen bg-[#0a0a0c]">
            {/* Global Header (Post-Auth) */}
            {user && (
                <div className="fixed top-6 right-8 z-[60] flex items-center gap-4 animate-in slide-in-from-right duration-500">
                    {user.is_anonymous && (
                        <button
                            onClick={() => setShowAuth(true)}
                            className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold text-xs flex items-center gap-2 border border-indigo-400/30"
                        >
                            <Layout className="w-3 h-4" />
                            DEVENIR MEMBRE
                        </button>
                    )}
                    <button
                        onClick={() => setView(view === 'dashboard' ? 'participation' : 'dashboard')}
                        className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl border border-white/10 backdrop-blur-xl transition-all font-bold text-xs flex items-center gap-2"
                    >
                        {view === 'dashboard' ? <Play className="w-3 h-4" /> : <Layout className="w-3 h-4" />}
                        {view === 'dashboard' ? 'ACCÉDER À LA SALLE' : 'MON HUB'}
                    </button>
                    <button
                        onClick={() => {
                            supabase.auth.signOut()
                            localStorage.removeItem('inseme_is_public')
                        }}
                        className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 transition-all font-bold text-xs group"
                        title="Déconnexion"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* 2. SaaS Dashboard */}
            {view === 'dashboard' && (
                <SaaSDashboard user={user} onSelectRoom={handleSelectRoom} />
            )}

            {/* 3. Assembly Room */}
            {view === 'participation' && (
                <div className="relative h-full w-full">
                    <InsemeRoom
                        roomName={roomName || 'Général'}
                        user={isSpectator ? null : user}
                        supabase={supabase}
                        config={{
                            promptUrl: '/prompts/inseme.md',
                            opheliaUrl: '/api/ophelia'
                        }}
                    />
                    
                    {/* Spectator Overlay */}
                    {isSpectator && (
                        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]">
                            <div className="px-4 py-2 bg-gray-900/90 backdrop-blur-md border border-white/10 rounded-full flex items-center gap-3 shadow-2xl">
                                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                                <span className="text-xs font-bold text-white uppercase tracking-widest">Mode Spectateur</span>
                                <div className="w-px h-4 bg-white/20 mx-1" />
                                <button 
                                    onClick={() => {
                                        setAuthInitialMode('anonymous')
                                        setShowAuth(true)
                                    }}
                                    className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-tighter transition-colors"
                                >
                                    Participer
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Guest Reconnection Prompt (Public Browser Safety) */}
            {showGuestReconnect && user?.is_anonymous && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <UserCheck className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 mb-2">Ravi de vous revoir !</h2>
                        <p className="text-gray-500 mb-8 leading-relaxed">
                            Vous êtes reconnu en tant que <span className="font-bold text-indigo-600">{user.user_metadata?.full_name || 'Invité'}</span>. 
                            <br />Est-ce bien vous ?
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => setShowGuestReconnect(false)}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/25"
                            >
                                OUI, C'EST MOI
                            </button>
                            <button
                                onClick={() => {
                                    supabase.auth.signOut()
                                    localStorage.removeItem('inseme_is_public')
                                    setShowGuestReconnect(false)
                                }}
                                className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl font-bold transition-all"
                            >
                                NON, CHANGER DE PROFIL
                            </button>
                        </div>
                        <p className="mt-6 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                            Sécurité navigateur public
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
