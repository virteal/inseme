-- Assure la disponibilité de gen_random_uuid() (normalement déjà activé sur Supabase)
create extension if not exists "pgcrypto";

--------------------------------------------------------------------------------
-- 1. Table des nœuds COP : cop_nodes
--------------------------------------------------------------------------------

create table public.cop_nodes (
  id uuid primary key default gen_random_uuid(),

  network_id text not null,
  node_id    text not null,

  base_url    text not null,
  cop_path    text not null default '/cop',
  events_path text not null default '/cop-events',
  stream_path text not null default '/cop-stream',

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cop_nodes_network_node_uniq unique (network_id, node_id)
);

-- Trigger de mise à jour de updated_at (optionnel, si vous avez déjà une infra standard, sinon à adapter)
create or replace function public.set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_on_cop_nodes on public.cop_nodes;

create trigger set_timestamp_on_cop_nodes
before update on public.cop_nodes
for each row
execute function public.set_timestamp();

--------------------------------------------------------------------------------
-- 2. Table des agents COP : cop_agents
--------------------------------------------------------------------------------

create table public.cop_agents (
  id uuid primary key default gen_random_uuid(),

  network_id  text not null,
  node_id     text not null,
  instance_id text not null,
  agent_name  text not null,

  handler_type text not null default 'runtime',  -- ex: 'runtime', 'webhook', etc.
  handler_path text,                             -- ex: chemin interne, URL, etc.

  intents  jsonb not null default '[]'::jsonb,   -- liste d'intents supportés
  active   boolean not null default true,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cop_agents_network_node_instance_agent_uniq
    unique (network_id, node_id, instance_id, agent_name)
);

drop trigger if exists set_timestamp_on_cop_agents on public.cop_agents;

create trigger set_timestamp_on_cop_agents
before update on public.cop_agents
for each row
execute function public.set_timestamp();

--------------------------------------------------------------------------------
-- 3. Table des événements COP (canaux / streaming) : cop_events
--------------------------------------------------------------------------------

create table public.cop_events (
  id bigint generated always as identity primary key,

  cop_version    text not null,
  event_id       uuid not null,
  correlation_id uuid,

  from_addr text not null,   -- adresse COP_ADDR de l’émetteur
  channel   text not null,   -- adresse COPCHAN_ADDR

  event_type text not null,  -- type fonctionnel de l’événement
  payload    jsonb not null, -- contenu de l’événement

  metadata jsonb,            -- métadonnées supplémentaires (optionnel)

  created_at timestamptz not null default now()
);

-- Index pour la lecture par canal (streaming / pagination)
create index if not exists cop_events_channel_idx
  on public.cop_events (channel, id);

-- Index pour la lecture par correlation_id (traces, debugging)
create index if not exists cop_events_corr_idx
  on public.cop_events (correlation_id, id);

--------------------------------------------------------------------------------
-- 4. Table de log/debug COP : cop_debug_logs
--    (trace par correlation_id, multi-stages, multi-emplacements)
--------------------------------------------------------------------------------

create table public.cop_debug_logs (
  id bigint generated always as identity primary key,

  correlation_id uuid,   -- identifiant logique de la requête/interaction
  message_id     uuid,   -- éventuellement, message_id COP
  event_id       uuid,   -- éventuellement, event_id COP

  location  text not null,  -- 'cop', 'cop-agent-runtime', 'cop-events', 'cop-stream', etc.
  stage     text not null,  -- 'received', 'forwarded', 'handled', 'error', ...
  direction text,           -- 'in', 'out', 'internal', ...

  metadata jsonb not null default '{}'::jsonb,  -- payload de debug (snapshot msg/event/contexte)

  created_at timestamptz not null default now()
);

-- Index principal pour suivre une trace par correlation_id
create index if not exists cop_debug_logs_corr_idx
  on public.cop_debug_logs (correlation_id, id);

-- Index secondaire par location (pour analyser un composant en particulier)
create index if not exists cop_debug_logs_location_idx
  on public.cop_debug_logs (location, id);
