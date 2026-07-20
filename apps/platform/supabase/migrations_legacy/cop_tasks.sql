-- 1) Table des tasks
create table if not exists public.cop_tasks (
  id uuid primary key default gen_random_uuid(),

  -- Métadonnées de la tâche
  task_type text not null,             -- ex: 'AUDIT_LEGAL_STATE', 'RAG_INDEXING'
  worker_agent_name text not null,    -- ex: 'AuditorAgent', 'Ophélia'

  -- Lien avec COP (corrélation globale éventuelle)
  root_correlation_id uuid,
  channel text,

  -- Incrémentalité / idempotence
  source_entity_id uuid,
  source_entity_type text,
  idempotency_hash text,

  -- Gestion OTP / queue
  status text not null default 'pending',   -- 'pending', 'running', 'completed', 'failed', 'cancelled'
  retry_count integer not null default 0,
  priority integer not null default 0,

  last_error text,

  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_cop_tasks_status_type
  on public.cop_tasks (status, task_type);

create index if not exists idx_cop_tasks_entity
  on public.cop_tasks (source_entity_id);

create index if not exists idx_cop_tasks_root_corr
  on public.cop_tasks (root_correlation_id);


-- 2) Table des steps
create table if not exists public.cop_steps (
  id uuid primary key default gen_random_uuid(),

  task_id uuid not null references public.cop_tasks(id) on delete cascade,

  name text not null,
  index_in_task integer not null default 0,

  status text not null default 'running',   -- 'running', 'completed', 'failed'
  input_hash text,
  last_error text,

  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_cop_steps_task
  on public.cop_steps (task_id);

create index if not exists idx_cop_steps_status
  on public.cop_steps (status);


-- 3) Extension de cop_artifacts (si pas déjà fait)
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'cop_artifacts'
      and column_name  = 'task_id'
  ) then
    alter table public.cop_artifacts
      add column task_id uuid references public.cop_tasks(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'cop_artifacts'
      and column_name  = 'task_step_id'
  ) then
    alter table public.cop_artifacts
      add column task_step_id uuid references public.cop_steps(id) on delete cascade;
  end if;
end $$;
