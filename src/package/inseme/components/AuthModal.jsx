
import React from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import Login from './Login'

export function AuthModal({ onClose, roomName, isUpgrading = false, onSpectator, initialMode = null }) {
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState(null)

    // 1. ANONYMOUS: Uses nickname as dummy email or metadata if supported
    const handleSignInAnonymously = async (nickname) => {
        setLoading(true)
        setError(null)
        try {
            // NOTE: signInAnonymously normally doesn't take metadata directly in Supabase JS v2
            // But we can update the user immediately after if needed, or use a "guest" strategy.
            // For true anonymous, we just sign in. The nickname handling might need a custom logic 
            // once connected (e.g. updating profile). 
            // For now, we assume the user just wants access. 
            // Ideally, we'd pass options: { data: { full_name: nickname } } if supported.

            const { data, error } = await supabase.auth.signInAnonymously({
                options: {
                    data: { 
                        full_name: nickname || 'Invité',
                        source: 'inseme',
                        initial_room: roomName
                    }
                }
            })

            if (error) {
                // Specific handling for disabled anonymous sign-ins
                if (error.message.includes('Anonymous sign-ins are disabled')) {
                    throw new Error("L'accès invité est désactivé sur ce serveur Supabase. Veuillez activer 'Anonymous sign-ins' dans Authentication > Providers ou utilisez un compte email.")
                }
                throw error
            }
            onClose()
        } catch (err) {
            console.error('Error signing in anonymously:', err.message)
            setError(err.message || 'Erreur lors de la connexion anonyme')
        } finally {
            setLoading(false)
        }
    }

    // 2. EMAIL SIGN IN
    const handleSignInWithPassword = async (email, password) => {
        setLoading(true)
        setError(null)
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            })
            if (error) throw error
            onClose()
        } catch (err) {
            console.error('Sign In Error:', err.message)
            setError(err.message === 'Invalid login credentials' ? 'Identifiants incorrects' : err.message)
        } finally {
            setLoading(false)
        }
    }

    // 3. SIGN UP (Create Account)
    const handleSignUp = async (email, password, nickname) => {
        setLoading(true)
        setError(null)
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: nickname, // Store nickname in metadata
                        source: 'inseme',
                        initial_room: roomName
                    }
                }
            })
            if (error) throw error
            
            if (isUpgrading) {
                alert("Votre compte invité a été transformé en compte permanent ! Vous pouvez maintenant vous connecter avec votre email.")
            }
            onClose()
        } catch (err) {
            console.error('Sign Up Error:', err.message)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // 4. OAUTH PROVIDERS
    const handleSignInWithProvider = async (provider) => {
        setLoading(true)
        setError(null)
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: window.location.origin
                }
            })
            if (error) throw error
        } catch (err) {
            console.error(`Error signing in with ${provider}:`, err.message)
            setError(err.message || `Erreur lors de la connexion avec ${provider}`)
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors z-10"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="flex h-[600px]">
                    {/* Left Side - Login Component */}
                    <div className="w-full md:w-1/2 p-8 md:p-12 overflow-y-auto">
                        <Login 
                         onSignInAnonymously={handleSignInAnonymously}
                         onSignInWithProvider={handleSignInWithProvider}
                         onSignInWithPassword={handleSignInWithPassword}
                         onSignUp={handleSignUp}
                         onSpectator={onSpectator}
                         loading={loading}
                         error={error}
                         roomName={roomName}
                         isUpgrading={isUpgrading}
                         initialMode={initialMode}
                     />
                    </div>

                    {/* Right Side - Visual/Info */}
                    <div className="hidden md:flex w-1/2 bg-indigo-600 p-12 flex-col justify-between text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                        <div className="relative z-10">
                            <h3 className="text-3xl font-black tracking-tight mb-4">L'Assemblée<br />Augmentée.</h3>
                            <p className="text-white/80 font-medium leading-relaxed">
                                Rejoignez un espace de délibération nouvelle génération. Votez, débattez et construisez le consensus avec l'aide d'Ophélia.
                            </p>
                        </div>

                        <div className="relative z-10 text-xs font-bold uppercase tracking-widest opacity-60">
                            Inseme v2.0
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
