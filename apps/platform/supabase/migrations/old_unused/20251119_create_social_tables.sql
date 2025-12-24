-- ============================================================================
-- MIGRATION: TABLES SOCIALES (Forum + Blogs + Communautés)
-- Date: 2025-11-19
-- Description: Création des tables pour le système social (réactions, rôles,
--              tracking lecture, logs activité) avec RLS policies
-- ============================================================================

-- ============================================================================
-- NOUVELLES TABLES
-- ============================================================================

-- Réactions emoji sur posts et comments
CREATE TABLE IF NOT EXISTS public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, target_type, target_id, emoji)
);

-- Rôles dans les groupes (admin/member)
CREATE TABLE IF NOT EXISTS public.group_roles (
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member' NOT NULL CHECK (role IN ('admin', 'member')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

-- Suivi de lecture des posts (pour notifications)
CREATE TABLE IF NOT EXISTS public.read_tracking (
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  last_read_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

-- Log d'activité (audit trail simple pour modération)
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- TRIGGERS updated_at
-- ============================================================================

CREATE TRIGGER set_updated_at_group_roles
  BEFORE UPDATE ON public.group_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INDEX POUR PERFORMANCE
-- ============================================================================

-- Reactions
CREATE INDEX IF NOT EXISTS idx_reactions_target ON public.reactions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON public.reactions(user_id);

-- Group roles
CREATE INDEX IF NOT EXISTS idx_group_roles_user ON public.group_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_group_roles_group ON public.group_roles(group_id);

-- Read tracking
CREATE INDEX IF NOT EXISTS idx_read_tracking_user ON public.read_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_read_tracking_post ON public.read_tracking(post_id);

-- Activity log
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_resource ON public.activity_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.activity_log(user_id);

-- ============================================================================
-- RLS (ROW LEVEL SECURITY) POLICIES
-- ============================================================================

-- Enable RLS sur toutes les nouvelles tables
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Reactions: lecture publique, création/suppression authentifiée
CREATE POLICY "Anyone can read reactions"
  ON public.reactions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can add reactions"
  ON public.reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own reactions"
  ON public.reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Group roles: lecture publique, seuls admins et créateur peuvent modifier
CREATE POLICY "Anyone can read group roles"
  ON public.group_roles FOR SELECT
  USING (true);

CREATE POLICY "Group admins can add members"
  ON public.group_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id
      AND (g.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.group_roles gr
        WHERE gr.group_id = g.id
        AND gr.user_id = auth.uid()
        AND gr.role = 'admin'
      ))
    )
  );

CREATE POLICY "Group admins can update roles"
  ON public.group_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id
      AND (g.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.group_roles gr
        WHERE gr.group_id = g.id
        AND gr.user_id = auth.uid()
        AND gr.role = 'admin'
      ))
    )
  );

CREATE POLICY "Group admins can remove members"
  ON public.group_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id
      AND (g.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.group_roles gr
        WHERE gr.group_id = g.id
        AND gr.user_id = auth.uid()
        AND gr.role = 'admin'
      ))
    )
  );

-- Read tracking: chaque utilisateur gère son propre tracking
CREATE POLICY "Users can read their own tracking"
  ON public.read_tracking FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own tracking"
  ON public.read_tracking FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can modify their own tracking"
  ON public.read_tracking FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Activity log: lecture publique (transparence), création par système
CREATE POLICY "Anyone can read activity log"
  ON public.activity_log FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can log actions"
  ON public.activity_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES POUR TABLES EXISTANTES (groups, posts, comments)
-- ============================================================================

-- Groups: lecture publique, création authentifiée, modification par créateur
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read groups"
  ON public.groups FOR SELECT
  USING (
    metadata->>'isDeleted' IS NULL
    OR metadata->>'isDeleted' = 'false'
  );

CREATE POLICY "Authenticated users can create groups"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group creators can update their groups"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Group creators can delete their groups"
  ON public.groups FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Posts: lecture publique (sauf supprimés), création authentifiée
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read non-deleted posts"
  ON public.posts FOR SELECT
  USING (
    metadata->>'isDeleted' IS NULL
    OR metadata->>'isDeleted' = 'false'
  );

CREATE POLICY "Authenticated users can create posts"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
  ON public.posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Comments: lecture publique (sauf supprimés), création authentifiée
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read non-deleted comments"
  ON public.comments FOR SELECT
  USING (
    metadata->>'isDeleted' IS NULL
    OR metadata->>'isDeleted' = 'false'
  );

CREATE POLICY "Authenticated users can create comments"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


