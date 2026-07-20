-- Migration: Ajout des mandats et évolution des actes
-- Date: 2025-12-31

-- 1. Ajout du rôle 'represented' à la table users (si non présent)
-- Note: Dans Supabase, pour modifier un CHECK constraint, il faut le supprimer et le recréer.
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role = ANY (ARRAY['user'::text, 'moderator'::text, 'admin'::text, 'ai'::text, 'represented'::text]));

-- 2. Création de la table mandats
CREATE TABLE IF NOT EXISTS public.mandats ( 
  id_mandat uuid NOT NULL DEFAULT gen_random_uuid(), 
  user_id uuid NOT NULL REFERENCES public.users(id), 
  role text NOT NULL,                      -- rôle officiel ou mandaté 
  start_date date NOT NULL, 
  end_date date, 
  commissions jsonb DEFAULT '[]'::jsonb,  -- responsabilités spécifiques 
  subtype text,                            -- type de communauté/collectivité 
  source text,                             -- référence officielle 
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb, 
  CONSTRAINT mandats_pkey PRIMARY KEY (id_mandat) 
);

-- 3. Transformation de la table acte en actes
-- On vérifie d'abord si la table 'acte' existe avant de la renommer
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'acte') THEN
    ALTER TABLE public.acte RENAME TO actes;
  END IF;
END $$;

-- 4. Mise à jour de la table actes (ex-acte)
-- Ajouter le lien vers mandat
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'actes' AND column_name = 'mandat_id') THEN
    ALTER TABLE public.actes ADD COLUMN mandat_id uuid NULL REFERENCES public.mandats(id_mandat);
  END IF;
END $$;

-- Ajouter metadata si non présent (déjà présent dans le schema.sql d'origine mais par sécurité)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'actes' AND column_name = 'metadata') THEN
    ALTER TABLE public.actes ADD COLUMN metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb;
  END IF;
END $$;
