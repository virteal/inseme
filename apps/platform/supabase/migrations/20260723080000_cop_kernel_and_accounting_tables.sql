-- Migration: COP Core and Accounting Kernel Tables for Personal Instance Node (jhn.baronsmariani.org)
-- Date: 2026-07-23

CREATE EXTENSION IF NOT EXISTS pgcrypto;

--------------------------------------------------------------------------------
-- 1. COP Core Orchestration Tables (Topics, Tasks, Steps, Events, Artifacts)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cop_topic (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'open',
  current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
  title text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cop_task (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.cop_topic(id) ON DELETE CASCADE,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  worker_id text DEFAULT NULL,
  lease_expires_at timestamptz DEFAULT NULL,
  last_error text DEFAULT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cop_step (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.cop_task(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  input jsonb DEFAULT '{}'::jsonb,
  output jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cop_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.cop_topic(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  meta jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cop_artifact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.cop_topic(id) ON DELETE CASCADE,
  source_task_id uuid REFERENCES public.cop_task(id) ON DELETE SET NULL,
  source_step_id uuid REFERENCES public.cop_step(id) ON DELETE SET NULL,
  type text NOT NULL,
  format text,
  payload jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

--------------------------------------------------------------------------------
-- 2. Fractanet Network & Agent Registry (Nodes & Agents)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cop_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id text NOT NULL,
  node_id text NOT NULL,
  base_url text NOT NULL,
  cop_path text NOT NULL DEFAULT '/cop',
  events_path text NOT NULL DEFAULT '/cop-events',
  stream_path text NOT NULL DEFAULT '/cop-stream',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cop_nodes_network_node_uniq UNIQUE (network_id, node_id)
);

CREATE TABLE IF NOT EXISTS public.cop_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id text NOT NULL,
  node_id text NOT NULL,
  instance_id text NOT NULL,
  agent_name text NOT NULL,
  handler_type text NOT NULL DEFAULT 'runtime',
  handler_path text,
  intents jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cop_agents_network_node_instance_agent_uniq UNIQUE (network_id, node_id, instance_id, agent_name)
);

--------------------------------------------------------------------------------
-- 3. COP Accounting Kernel Tables (Events, Balances, Budgets)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cop_accounting_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version text NOT NULL DEFAULT '1.0',
  event_type text NOT NULL, -- budget, reservation, transaction, reversal, account
  idempotency_key text UNIQUE,
  topic_id uuid REFERENCES public.cop_topic(id) ON DELETE SET NULL,
  actor_id text NOT NULL,
  principal_id text NOT NULL,
  mandate_ref text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cop_accounting_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  unit text NOT NULL DEFAULT 'EUR',
  domain text NOT NULL DEFAULT 'general',
  total_debit jsonb NOT NULL DEFAULT '{"coefficient":"0","scale":0}'::jsonb,
  total_credit jsonb NOT NULL DEFAULT '{"coefficient":"0","scale":0}'::jsonb,
  balance jsonb NOT NULL DEFAULT '{"coefficient":"0","scale":0}'::jsonb,
  last_event_id uuid REFERENCES public.cop_accounting_event(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cop_accounting_balance_account_unit_domain_uniq UNIQUE (account_id, unit, domain)
);

CREATE TABLE IF NOT EXISTS public.cop_accounting_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id text UNIQUE NOT NULL,
  account_id text NOT NULL,
  domain text NOT NULL DEFAULT 'general',
  granted jsonb NOT NULL DEFAULT '{"coefficient":"0","scale":0}'::jsonb,
  available jsonb NOT NULL DEFAULT '{"coefficient":"0","scale":0}'::jsonb,
  reserved jsonb NOT NULL DEFAULT '{"coefficient":"0","scale":0}'::jsonb,
  committed jsonb NOT NULL DEFAULT '{"coefficient":"0","scale":0}'::jsonb,
  spent jsonb NOT NULL DEFAULT '{"coefficient":"0","scale":0}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  expiration_time timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

--------------------------------------------------------------------------------
-- 4. Indexes & Row-Level Security
--------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_cop_task_topic_status ON public.cop_task(topic_id, status);
CREATE INDEX IF NOT EXISTS idx_cop_event_topic_created_at ON public.cop_event(topic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cop_artifact_topic ON public.cop_artifact(topic_id);
CREATE INDEX IF NOT EXISTS idx_cop_acct_event_idempotency ON public.cop_accounting_event(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_cop_acct_balance_account ON public.cop_accounting_balance(account_id);
CREATE INDEX IF NOT EXISTS idx_cop_acct_budget_account ON public.cop_accounting_budget(account_id);

ALTER TABLE public.cop_topic ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_task ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_artifact ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_accounting_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_accounting_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_accounting_budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read topics" ON public.cop_topic FOR SELECT USING (true);
CREATE POLICY "Public read cop_nodes" ON public.cop_nodes FOR SELECT USING (true);
CREATE POLICY "Public read cop_agents" ON public.cop_agents FOR SELECT USING (true);
CREATE POLICY "Public read cop_accounting_balance" ON public.cop_accounting_balance FOR SELECT USING (true);
CREATE POLICY "Public read cop_accounting_budget" ON public.cop_accounting_budget FOR SELECT USING (true);
