create table public.cop_agent_identities (
  agent_id uuid primary key default gen_random_uuid(),

  agent_name text not null,
  agent_class text not null,
  description text,

  -- relationnel / responsabilité
  owner_human_id uuid,
  owner_group_id uuid,
  operator_id uuid,

  -- mandat / capacités
  domains jsonb not null default '[]',
  permissions jsonb not null default '{}',
  constraints jsonb not null default '{}',
  issued_by text,
  valid_until timestamptz,

  -- comportement
  profile jsonb not null default '{}',

  -- statut
  status text not null default 'active', -- active | suspended | revoked | expired

  metadata jsonb not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cop_agent_identities_name
  on public.cop_agent_identities (agent_name);

create index if not exists idx_cop_agent_identities_status
  on public.cop_agent_identities (status);
