-- COP Accounting: packet spend index + normalized postings + semantic account refs
-- Complements 20260723080000_cop_kernel_and_accounting_tables.sql
-- Architecture: inseme#39, packages/cop-core/COP_ACCOUNTING.md

--------------------------------------------------------------------------------
-- Normalized postings (optional materialization of event payload postings)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cop_accounting_posting (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.cop_accounting_event(id) ON DELETE CASCADE,
  posting_index int NOT NULL DEFAULT 0,
  account_id text NOT NULL,
  posting_type text NOT NULL CHECK (posting_type IN ('debit', 'credit')),
  quantity jsonb NOT NULL,
  description text,
  semantic_account_id text,
  -- Analytical dimensions (comptabilité analytique) — not authorization
  packet_id text,
  treatment_id text,
  mandate_id text,
  twin_id text,
  legal_host_id text,
  provider text,
  model text,
  capability text,
  surface text,
  valuation_status text NOT NULL DEFAULT 'provisional',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cop_accounting_posting_event_idx_uniq UNIQUE (event_id, posting_index)
);

CREATE INDEX IF NOT EXISTS idx_cop_acct_posting_account ON public.cop_accounting_posting(account_id);
CREATE INDEX IF NOT EXISTS idx_cop_acct_posting_packet ON public.cop_accounting_posting(packet_id);
CREATE INDEX IF NOT EXISTS idx_cop_acct_posting_treatment ON public.cop_accounting_posting(treatment_id);

--------------------------------------------------------------------------------
-- Packet own-spend index (one row per provisional spend event, not consolidated)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cop_accounting_packet_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id text NOT NULL,
  treatment_id text,
  hop_index int,
  provider text,
  model text,
  event_id uuid REFERENCES public.cop_accounting_event(id) ON DELETE SET NULL,
  idempotency_key text UNIQUE NOT NULL,
  provisional_cost jsonb NOT NULL,
  valuation_status text NOT NULL DEFAULT 'provisional',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cop_acct_packet_spend_packet ON public.cop_accounting_packet_spend(packet_id);

--------------------------------------------------------------------------------
-- Semantic chart registry (versioned)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cop_accounting_chart_account (
  id text PRIMARY KEY,
  family text NOT NULL,
  label text NOT NULL,
  chart_version text NOT NULL DEFAULT '0.1.0',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

--------------------------------------------------------------------------------
-- RLS
--------------------------------------------------------------------------------

ALTER TABLE public.cop_accounting_posting ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_accounting_packet_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_accounting_chart_account ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read cop_accounting_posting" ON public.cop_accounting_posting;
CREATE POLICY "Public read cop_accounting_posting" ON public.cop_accounting_posting FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read cop_accounting_packet_spend" ON public.cop_accounting_packet_spend;
CREATE POLICY "Public read cop_accounting_packet_spend" ON public.cop_accounting_packet_spend FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read cop_accounting_chart_account" ON public.cop_accounting_chart_account;
CREATE POLICY "Public read cop_accounting_chart_account" ON public.cop_accounting_chart_account FOR SELECT USING (true);
