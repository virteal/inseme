create table public.cop_artifacts (
  id uuid primary key default gen_random_uuid(),

  correlation_id uuid,
  message_id     uuid,
  event_id       uuid,

  -- qui a créé l'artifact
  network_id  text,
  node_id     text,
  instance_id text,
  agent_name  text,

  -- classification fonctionnelle
  artifact_type text not null, -- ex: 'summary', 'decision', 'task_list', 'fact', 'file_ref'
  artifact_kind text not null, -- ex: 'conversation', 'action', 'knowledge', 'media'

  -- contenu JSON
  content  jsonb not null,     -- structure fonctionnelle de l'artifact
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists cop_artifacts_corr_idx
  on public.cop_artifacts (correlation_id, created_at);

create index if not exists cop_artifacts_type_idx
  on public.cop_artifacts (artifact_type, created_at);
