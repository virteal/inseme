-- Messages table for chat and state
create table if not exists inseme_messages (
  id uuid default gen_random_uuid() primary key,
  room_id text not null,
  user_id uuid references auth.users(id),
  name text not null,
  message text not null,
  created_at timestamptz default now()
);

-- Enable Realtime for the messages table
do $$
begin
  if not exists (
    select 1 
    from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'inseme_messages'
  ) then
    alter publication supabase_realtime add table inseme_messages;
  end if;
end $$;

-- Enable RLS
alter table inseme_messages enable row level security;

-- Policies
begin;
  drop policy if exists "Anyone can read messages" on inseme_messages;
  create policy "Anyone can read messages" 
  on inseme_messages for select 
  using (true);

  drop policy if exists "Authenticated/Anon users can insert messages" on inseme_messages;
  create policy "Authenticated/Anon users can insert messages" 
  on inseme_messages for insert 
  with check (auth.uid() = user_id or user_id is null);
commit;

-- Index for room_id
create index if not exists idx_ inseme_messages_room_id on inseme_messages(room_id);
