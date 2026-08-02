-- Supabase/PostgreSQL defence in depth for the portable COP runtime tables.
--
-- The ESM gateway remains the normative authorization point. These database
-- controls prevent direct anon/authenticated PostgREST access from becoming a
-- bypass when the tables are present in Supabase's exposed public schema.

ALTER TABLE public.cop_handlers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_logical_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_artifacts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.cop_handlers FROM anon, authenticated;
REVOKE ALL ON TABLE public.cop_mandates FROM anon, authenticated;
REVOKE ALL ON TABLE public.cop_logical_agents FROM anon, authenticated;
REVOKE ALL ON TABLE public.cop_tasks FROM anon, authenticated;
REVOKE ALL ON TABLE public.cop_steps FROM anon, authenticated;
REVOKE ALL ON TABLE public.cop_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.cop_artifacts FROM anon, authenticated;
