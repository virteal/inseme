
-- Municipal transparency data collection

create table if not exists municipal_transparency (
  id uuid primary key default gen_random_uuid(),
  commune_name text not null,
  insee_code text,
  population integer check (population >= 0),
  agenda_mentions_location boolean not null default false,
  livestreamed boolean not null default false,
  minutes_published_under_week boolean not null default false,
  deliberations_open_data boolean not null default false,
  annual_calendar_published boolean not null default false,
  public_can_speak boolean not null default false,
  contact_email text,
  submitted_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists municipal_transparency_commune_name_key
  on municipal_transparency (lower(commune_name));

create unique index if not exists municipal_transparency_insee_code_key
  on municipal_transparency (insee_code) where insee_code is not null;

create or replace function municipal_transparency_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_timestamp
  before update on municipal_transparency
  for each row
  execute procedure municipal_transparency_set_updated_at();

alter table municipal_transparency enable row level security;

create policy "Public read access" on municipal_transparency
  for select using (true);

create policy "Authenticated upsert" on municipal_transparency
  for insert
  to authenticated
  with check (true);

create policy "Authenticated update" on municipal_transparency
  for update
  to authenticated
  using (true)
  with check (true);
