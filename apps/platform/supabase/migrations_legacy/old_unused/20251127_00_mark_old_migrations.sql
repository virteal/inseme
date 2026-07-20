-- Mark historic migrations as already applied
INSERT INTO supabase_migrations (id, name, checksum, executed_at)
VALUES
  ('001_rag_infrastructure.sql',                '001_rag_infrastructure.sql',                md5('placeholder'), now()),
  ('20251021213045_create_kudocracy_schema.sql','20251021213045_create_kudocracy_schema.sql',md5('placeholder'), now()),
  ('20251104120000_create_municipal_transparency_table.sql','20251104120000_create_municipal_transparency_table.sql',md5('placeholder'), now()),
  ('20251119_create_social_tables.sql',         '20251119_create_social_tables.sql',         md5('placeholder'), now()),
  ('20251119_create_user_profile_trigger.sql','20251119_create_user_profile_trigger.sql',md5('placeholder'), now()),
  ('20251120_add_count_user_subscribers_function.sql','20251120_add_count_user_subscribers_function.sql',md5('placeholder'), now()),
  ('20251120_allow_null_votes_for_blank.sql','20251120_allow_null_votes_for_blank.sql',md5('placeholder'), now()),
  ('20251120_create_content_subscriptions.sql','20251120_create_content_subscriptions.sql',md5('placeholder'), now()),
  ('20251120_create_document_sources.sql','20251120_create_document_sources.sql',md5('placeholder'), now()),
  ('20251120_create_tasks_table.sql','20251120_create_tasks_table.sql',md5('placeholder'), now()),
  ('20251120_enable_rls_wiki_pages.sql','20251120_enable_rls_wiki_pages.sql',md5('placeholder'), now()),
  ('20251123_create_collected_data.sql','20251123_create_collected_data.sql',md5('placeholder'), now()),
  ('add_reactions_rls_policies.sql','add_reactions_rls_policies.sql',md5('placeholder'), now()),
  ('create_reactions_table.sql','create_reactions_table.sql',md5('placeholder'), now())
ON CONFLICT (id) DO NOTHING;
