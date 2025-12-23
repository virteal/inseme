import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { AuthModal } from './package/inseme/components/AuthModal'
import { InsemeRoom } from './package/inseme'
import { SaaSDashboard } from './components/SaaS/SaaSDashboard'
import { LandingPage } from './components/SaaS/LandingPage'
import { Layout, Play, LogOut } from 'lucide-react'

function App() {
    const [user, setUser] = useState(null)
    const [roomName, setRoomName] = useState('')
    const [showAuth, setShowAuth] = useState(false)
    const [view, setView] = useState('landing') // 'landing', 'dashboard', 'participation'

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            const currentUser = session?.user ?? null
            setUser(currentUser)

            // Determine initial view
            const params = new URLSearchParams(window.location.search)
            const room = params.get('room')
            if (room) {
                setRoomName(room)
                setView('participation')
            } else if (currentUser) {
                setView('dashboard')
            } else {
                setView('landing')
            }
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user ?? null
            setUser(currentUser)
            if (currentUser && view === 'landing') {
                setView('dashboard')
            } else if (!currentUser) {
                setView('landing')
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const handleSelectRoom = (slug) => {
        setRoomName(slug)
        setView('participation')
        const url = new URL(window.location)
        url.searchParams.set('room', slug)
        window.history.pushState({}, '', url)
    }

    if (!user && showAuth) {
        return <AuthModal onClose={() => setShowAuth(false)} />
    }

    // --- RENDER MODES ---

    // 1. Landing Page (Public)
    if (view === 'landing') {
        return <LandingPage onLogin={() => setShowAuth(true)} />
    }

    return (
        <div className="min-h-screen bg-[#0a0a0c]">
            {/* Global Header (Post-Auth) */}
            {user && (
                <div className="fixed top-6 right-8 z-[60] flex items-center gap-4 animate-in slide-in-from-right duration-500">
                    <button
                        onClick={() => setView(view === 'dashboard' ? 'participation' : 'dashboard')}
                        className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl border border-white/10 backdrop-blur-xl transition-all font-bold text-xs flex items-center gap-2"
                    >
                        {view === 'dashboard' ? <Play className="w-3 h-4" /> : <Layout className="w-3 h-4" />}
                        {view === 'dashboard' ? 'DÉMARRER' : 'MON HUB'}
                    </button>
                    <button
                        onClick={() => supabase.auth.signOut()}
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
                <InsemeRoom
                    roomName={roomName || 'Général'}
                    user={user}
                    supabase={supabase}
                    config={{
                        promptUrl: '/prompts/inseme.md',
                        opheliaUrl: '/api/ophelia'
                    }}
                />
            )}
        </div>
    )
}

export default App
