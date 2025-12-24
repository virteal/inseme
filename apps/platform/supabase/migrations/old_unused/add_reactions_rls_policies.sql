-- ============================================
-- Politiques RLS pour la table REACTIONS
-- ============================================

-- Activer RLS si ce n'est pas déjà fait
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Reactions are viewable by everyone" ON public.reactions;
DROP POLICY IF EXISTS "Authenticated users can insert reactions" ON public.reactions;
DROP POLICY IF EXISTS "Users can delete their own reactions" ON public.reactions;
DROP POLICY IF EXISTS "Users can update their own reactions" ON public.reactions;

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
