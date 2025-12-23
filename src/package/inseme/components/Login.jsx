import React, { useState } from 'react'
import { Github, Facebook, Mail, User, ArrowRight } from 'lucide-react'

export default function Login({
    onSignInAnonymously,
    onSignInWithProvider,
    onSignInWithPassword,
    onSignUp,
    onSpectator,
    loading,
    error,
    roomName,
    isUpgrading = false,
    initialMode = null
}) {
    const [mode, setMode] = useState(initialMode || (isUpgrading ? 'signup' : 'signin')) // 'signin', 'signup', 'anonymous'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [nickname, setNickname] = useState('')
    const [isPublic, setIsPublic] = useState(false)

    const handleSubmit = (e) => {
        e.preventDefault()
        if (mode === 'signin') {
            onSignInWithPassword(email, password)
        } else if (mode === 'signup') {
            onSignUp(email, password, nickname)
        } else if (mode === 'anonymous') {
            if (isPublic) {
                localStorage.setItem('inseme_is_public', 'true')
            } else {
                localStorage.removeItem('inseme_is_public')
            }
            onSignInAnonymously(nickname)
        }
    }

    return (
        <div className="flex flex-col items-center justify-center h-full max-w-sm mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {roomName && (
                <div className="mb-4 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">
                        Salle : {roomName}
                    </p>
                </div>
            )}
            <div className="text-center space-y-2 mb-8">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">
                    {isUpgrading ? 'Sauvegarder mon compte' : (mode === 'signup' ? 'Créer un compte' : (mode === 'anonymous' ? 'Accès Invité' : 'Bienvenue'))}
                </h2>
                <p className="text-gray-500 text-sm font-medium">
                    {isUpgrading ? 'Enregistrez-vous pour conserver votre historique' : (mode === 'signup' ? 'Rejoignez la communauté Inseme' : (mode === 'anonymous' ? 'Participez aux débats instantanément' : 'Connectez-vous pour participer'))}
                </p>
            </div>

            {error && (
                <div className="w-full p-3 mb-6 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100 text-center uppercase tracking-wide">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="w-full space-y-4">

                {/* Nickname Field - Only for Sign Up or Anonymous */}
                {(mode === 'signup' || mode === 'anonymous') && (
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest px-1">Pseudonyme</label>
                        <input
                            type="text"
                            required
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder="Comment doit-on vous appeler ?"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-gray-900"
                        />
                    </div>
                )}

                {/* Public Browser Toggle - Only for Anonymous */}
                {mode === 'anonymous' && (
                    <div className="flex items-center gap-2 px-1">
                        <input 
                            type="checkbox" 
                            id="public-browser"
                            checked={isPublic}
                            onChange={(e) => setIsPublic(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="public-browser" className="text-xs text-gray-500 font-medium cursor-pointer select-none">
                            Ceci est un ordinateur public (sécurité renforcée)
                        </label>
                    </div>
                )}

                {/* Email & Password - Only for Sign In or Sign Up */}
                {mode !== 'anonymous' && (
                    <>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest px-1">Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="votre@email.com"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-gray-900"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest px-1">Mot de passe</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-gray-900"
                            />
                        </div>
                    </>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'anonymous' ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20' : 'bg-gray-900 hover:bg-black text-white shadow-gray-900/10'}`}
                >
                    <span>{loading ? 'Chargement...' : (mode === 'signup' ? "S'inscrire" : (mode === 'anonymous' ? 'ENTRER DANS LA SALLE' : 'Se connecter'))}</span>
                    {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                </button>
            </form>

            {/* Mode Toggles */}
            {!isUpgrading && (
                <div className="mt-8 flex flex-col gap-3 w-full">
                    {mode !== 'anonymous' && (
                        <>
                            <div className="relative flex items-center gap-4">
                                <div className="h-px bg-gray-200 flex-1"></div>
                                <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">OU</span>
                                <div className="h-px bg-gray-200 flex-1"></div>
                            </div>

                            {/* Social Buttons */}
                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <button onClick={() => onSignInWithProvider('google')} disabled={loading} className="py-2.5 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold text-xs flex items-center justify-center gap-2 transition-all">
                                    <Mail className="w-4 h-4" /> Google
                                </button>
                                <button onClick={() => onSignInWithProvider('github')} disabled={loading} className="py-2.5 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold text-xs flex items-center justify-center gap-2 transition-all">
                                    <Github className="w-4 h-4" /> Github
                                </button>
                            </div>
                        </>
                    )}

                    {/* Switch Modes */}
                    <div className="mt-6 text-center space-y-3">
                        {mode === 'signin' && (
                            <>
                                <p className="text-xs text-gray-500">Pas encore de compte ? <button onClick={() => setMode('signup')} className="text-indigo-600 font-bold hover:underline">Créer un compte</button></p>
                                <button 
                                    onClick={() => setMode('anonymous')}
                                    className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-indigo-200 hover:text-indigo-500 transition-all text-xs font-black uppercase tracking-widest"
                                >
                                    Rejoindre comme Invité (Rapide)
                                </button>
                            </>
                        )}
                        {mode === 'signup' && (
                            <p className="text-xs text-gray-500">Déjà inscrit ? <button onClick={() => setMode('signin')} className="text-indigo-600 font-bold hover:underline">Se connecter</button></p>
                        )}
                        {mode === 'anonymous' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                    <p className="text-[11px] text-indigo-700 leading-relaxed font-medium">
                                        L'accès invité vous permet de participer immédiatement. Vos messages et votes seront associés à votre pseudonyme.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <p className="text-xs text-gray-500">Vous avez déjà un compte ? <button onClick={() => setMode('signin')} className="text-indigo-600 font-bold hover:underline">Se connecter</button></p>
                                    <p className="text-xs text-gray-500">Ou <button onClick={onSpectator} className="text-gray-400 font-bold hover:underline">rester spectateur</button></p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
