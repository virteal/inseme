-- Table pour les abonnements à tout type de contenu
CREATE TABLE IF NOT EXISTS public.content_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('post', 'proposition', 'wiki_page')),
  content_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT content_subscriptions_unique UNIQUE (user_id, content_type, content_id)
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS content_subscriptions_user_id_idx ON public.content_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS content_subscriptions_content_idx ON public.content_subscriptions(content_type, content_id);

-- Politiques RLS
ALTER TABLE public.content_subscriptions ENABLE ROW LEVEL SECURITY;

-- Lecture publique (pour compter les abonnés)
CREATE POLICY "Anyone can view subscriptions"
  ON public.content_subscriptions
  FOR SELECT
  USING (true);

-- Création uniquement par utilisateurs authentifiés
CREATE POLICY "Authenticated users can subscribe"
  ON public.content_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Suppression uniquement de ses propres abonnements
CREATE POLICY "Users can unsubscribe from their own subscriptions"
  ON public.content_subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Commentaire
COMMENT ON TABLE public.content_subscriptions IS 
  'Abonnements des utilisateurs à différents types de contenus commentables';
