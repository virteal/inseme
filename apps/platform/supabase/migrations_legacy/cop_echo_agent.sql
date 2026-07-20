insert into public.cop_agents (
  network_id, node_id, instance_id, agent_name,
  handler_type, handler_path, intents, active, metadata
) values (
  'localnet',         -- à aligner avec COP_NETWORK_ID
  'localnode',        -- à aligner avec COP_NODE_ID
  'default',
  'echo',
  'runtime',
  null,
  '["echo.request"]'::jsonb,
  true,
  '{}'::jsonb
)
on conflict (network_id, node_id, instance_id, agent_name)
do update set
  handler_type = excluded.handler_type,
  handler_path = excluded.handler_path,
  intents      = excluded.intents,
  active       = excluded.active,
  metadata     = excluded.metadata;
