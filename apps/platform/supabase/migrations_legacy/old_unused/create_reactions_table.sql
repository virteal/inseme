-- ============================================
-- Table REACTIONS pour le système de réactions emoji
-- ============================================

-- Créer la table reactions
CREATE TABLE IF NOT EXISTS public.reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL, -- 'comment', 'post', etc.
    target_id UUID NOT NULL,
    emoji TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Une personne ne peut réagir qu'une fois avec le même emoji sur la même cible
    CONSTRAINT unique_user_target_emoji UNIQUE (user_id, target_type, target_id, emoji)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_reactions_target ON public.reactions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON public.reactions(user_id);

-- Activer RLS (Row Level Security)
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- Politique : Tout le monde peut voir les réactions
CREATE POLICY "Reactions are viewable by everyone"
    ON public.reactions
    FOR SELECT
    USING (true);

-- Politique : Les utilisateurs authentifiés peuvent ajouter des réactions
CREATE POLICY "Authenticated users can insert reactions"
    ON public.reactions
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Politique : Les utilisateurs peuvent supprimer leurs propres réactions
CREATE POLICY "Users can delete their own reactions"
    ON public.reactions
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Politique : Les utilisateurs peuvent modifier leurs propres réactions (optionnel)
CREATE POLICY "Users can update their own reactions"
    ON public.reactions
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Commentaires pour documentation
COMMENT ON TABLE public.reactions IS 'Réactions emoji sur les posts, commentaires, etc.';
COMMENT ON COLUMN public.reactions.target_type IS 'Type de la cible (comment, post, etc.)';
COMMENT ON COLUMN public.reactions.target_id IS 'ID de la cible';
COMMENT ON COLUMN public.reactions.emoji IS 'Emoji de la réaction';
COMMENT ON COLUMN public.reactions.metadata IS 'Métadonnées additionnelles au format JSONB';
