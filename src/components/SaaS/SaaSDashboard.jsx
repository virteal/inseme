import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Settings, Play, Trash2, Bot, Layout, Globe, ArrowLeft, Save, Sparkles } from 'lucide-react';

export function SaaSDashboard({ user, onSelectRoom }) {
    const [rooms, setRooms] = useState([]);
    const [view, setView] = useState('list'); // 'list', 'edit'
    const [isCreating, setIsCreating] = useState(false);
    const [newRoom, setNewRoom] = useState({ name: '', slug: '' });
    const [editingRoom, setEditingRoom] = useState(null);

    useEffect(() => {
        fetchRooms();
    }, [user]);

    const fetchRooms = async () => {
        const { data, error } = await supabase
            .from('inseme_rooms')
            .select('*')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false });

        if (!error) setRooms(data);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        const { data, error } = await supabase
            .from('inseme_rooms')
            .insert([{
                name: newRoom.name,
                slug: newRoom.slug || newRoom.name.toLowerCase().replace(/\s+/g, '-'),
                owner_id: user.id,
                settings: {
                    ophelia: {
                        voice: 'nova',
                        prompt: 'Tu es Ophélia, une médiatrice experte...'
                    }
                }
            }])
            .select();

        if (!error) {
            setRooms([data[0], ...rooms]);
            setIsCreating(false);
            setNewRoom({ name: '', slug: '' });
        } else {
            alert("Erreur lors de la création de la salle: " + error.message);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        const { error } = await supabase
            .from('inseme_rooms')
            .update({
                name: editingRoom.name,
                settings: editingRoom.settings
            })
            .eq('id', editingRoom.id);

        if (!error) {
            setRooms(rooms.map(r => r.id === editingRoom.id ? editingRoom : r));
            setView('list');
        } else {
            alert("Erreur lors de la mise à jour: " + error.message);
        }
    };

    if (view === 'edit' && editingRoom) {
        return (
            <div className="max-w-4xl mx-auto p-8 animate-in fade-in duration-500">
                <button
                    onClick={() => setView('list')}
                    className="flex items-center gap-2 text-white/40 hover:text-white mb-8 transition-colors group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    RETOUR AU HUB
                </button>

                <div className="bg-neutral-900/40 border border-white/5 rounded-[2rem] p-10 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Settings className="w-32 h-32" />
                    </div>

                    <form onSubmit={handleUpdate} className="space-y-10 relative z-10">
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-tighter mb-2">Réglages de l'Espace</h2>
                            <p className="text-xs text-white/30 font-mono italic">ID: {editingRoom.slug}</p>
                        </div>

                        <div className="space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">Nom de la Salle</label>
                                    <input
                                        type="text"
                                        value={editingRoom.name}
                                        onChange={e => setEditingRoom({ ...editingRoom, name: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* AI Settings */}
                            <div className="pt-6 space-y-6 border-t border-white/5">
                                <div className="flex items-center gap-3">
                                    <Bot className="w-5 h-5 text-indigo-400" />
                                    <h3 className="text-lg font-bold text-white uppercase tracking-wider">Ophélia (Module IA)</h3>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1 flex justify-between items-center">
                                        Vocalité
                                        <span className="text-indigo-400 capitalize">{editingRoom.settings?.ophelia?.voice || 'nova'}</span>
                                    </label>
                                    <select
                                        value={editingRoom.settings?.ophelia?.voice || 'nova'}
                                        onChange={e => setEditingRoom({
                                            ...editingRoom,
                                            settings: {
                                                ...editingRoom.settings,
                                                ophelia: { ...editingRoom.settings?.ophelia, voice: e.target.value }
                                            }
                                        })}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                    >
                                        <option value="nova">Nova (Énergique)</option>
                                        <option value="shimmer">Shimmer (Douce)</option>
                                        <option value="alloy">Alloy (Neutre)</option>
                                        <option value="echo">Echo (Profonde)</option>
                                        <option value="fable">Fable (Narrative)</option>
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">Prompt Système (Intelligence & Personnalité)</label>
                                    <textarea
                                        rows={8}
                                        value={editingRoom.settings?.ophelia?.prompt || ''}
                                        onChange={e => setEditingRoom({
                                            ...editingRoom,
                                            settings: {
                                                ...editingRoom.settings,
                                                ophelia: { ...editingRoom.settings?.ophelia, prompt: e.target.value }
                                            }
                                        })}
                                        placeholder="Décrivez comment Ophélia doit se comporter..."
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all font-mono"
                                    />
                                    <p className="text-[9px] text-white/20 italic">Note: Le prompt définit les règles de médiation et le ton d'Ophélia.</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-8">
                            <button
                                type="submit"
                                className="flex items-center gap-3 px-10 py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-black transition-all shadow-2xl shadow-indigo-500/20 active:scale-95 group"
                            >
                                <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                ENREGISTRER LES MODIFICATIONS
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto p-8 space-y-12 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tighter mb-2">Mon Hub <span className="text-indigo-500">Inseme</span></h1>
                    <p className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Gestion SaaS des Assemblées</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    NOUVELLE SALLE
                </button>
            </div>

            {/* Creation Modal/Form */}
            {isCreating && (
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl animate-in slide-in-from-top-4 duration-300">
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Nom de l'Assemblée</label>
                            <input
                                type="text"
                                required
                                value={newRoom.name}
                                onChange={e => setNewRoom({ ...newRoom, name: e.target.value })}
                                placeholder="ex: Coopérative Bastiaise"
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-white/10 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Slug URL (facultatif)</label>
                            <input
                                type="text"
                                value={newRoom.slug}
                                onChange={e => setNewRoom({ ...newRoom, slug: e.target.value })}
                                placeholder="ex: coop-bastia"
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-white/10 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                            />
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="px-6 py-3 text-white/40 hover:text-white font-bold transition-all"
                            >
                                ANNULER
                            </button>
                            <button
                                type="submit"
                                className="px-8 py-3 bg-white text-black rounded-2xl font-bold hover:bg-indigo-50 transition-all active:scale-95 shadow-xl"
                            >
                                CRÉER L'ESPACE
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Rooms Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rooms.map(room => (
                    <div key={room.id} className="bg-neutral-900/40 border border-white/5 hover:border-indigo-500/30 rounded-3xl p-6 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-20 group-hover:opacity-100 transition-opacity"></div>

                        <div className="flex justify-between items-start mb-6">
                            <div className="p-3 bg-white/5 rounded-2xl">
                                <Globe className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setEditingRoom(room); setView('edit'); }}
                                    className="p-2 text-white/20 hover:text-white/60 transition-colors"
                                >
                                    <Settings className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={async () => {
                                        if (confirm("Supprimer cette salle ? Toutes les données seront perdues.")) {
                                            const { error } = await supabase.from('inseme_rooms').delete().eq('id', room.id);
                                            if (!error) setRooms(rooms.filter(r => r.id !== room.id));
                                        }
                                    }}
                                    className="p-2 text-white/20 hover:text-rose-500 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2">{room.name}</h3>
                        <p className="text-xs text-white/30 font-mono mb-8">/{room.slug}</p>

                        <div className="flex items-center gap-4 py-4 border-t border-white/5 mb-6">
                            <div className="flex items-center gap-2">
                                <Bot className="w-3 h-3 text-indigo-400" />
                                <span className="text-[10px] font-bold text-white/60 uppercase">Ophélia Active</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Layout className="w-3 h-3 text-white/30" />
                                <span className="text-[10px] font-bold text-white/60 uppercase">Standard UI</span>
                            </div>
                        </div>

                        <button
                            onClick={() => onSelectRoom(room.slug)}
                            className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-2xl font-bold transition-all border border-indigo-500/20 active:scale-95"
                        >
                            <Play className="w-4 h-4" />
                            REJOINDRE
                        </button>
                    </div>
                ))}

                {rooms.length === 0 && !isCreating && (
                    <div className="col-span-full py-20 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-white/20 space-y-4">
                        <Plus className="w-12 h-12 opacity-10" />
                        <p className="font-bold uppercase tracking-widest text-sm">Aucune salle active</p>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="text-xs text-indigo-400/60 hover:text-indigo-400 underline transition-colors"
                        >
                            Créez votre première assemblée maintenant
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
