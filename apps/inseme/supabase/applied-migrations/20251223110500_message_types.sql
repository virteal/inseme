-- Evolve inseme_messages for Typed Events & rich Archiving
alter table inseme_messages 
add column if not exists type text default 'chat',
add column if not exists metadata jsonb default '{}'::jsonb;

-- Update index to include type for faster PV generation
create index if not exists idx_inseme_messages_room_type on inseme_messages(room_id, type);

comment on column inseme_messages.type is 'Type of event: chat, agenda_item, summary, vote_result, proposition, etc.';
comment on column inseme_messages.metadata is 'Structured data for the event (e.g., vote counts, agenda point id, etc.)';
