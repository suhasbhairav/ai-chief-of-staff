create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.department_snapshots (
  id uuid primary key default gen_random_uuid(),
  department_id text not null unique,
  department_name text not null,
  filename text,
  uploaded_at timestamptz not null default now(),
  headers jsonb not null default '[]'::jsonb,
  record_count integer not null default 0,
  sample_records jsonb not null default '[]'::jsonb,
  records jsonb not null default '[]'::jsonb,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_summaries (
  id text primary key default 'current',
  updated_at timestamptz not null default now(),
  total_departments integer not null default 0,
  total_records integer not null default 0,
  department_summaries jsonb not null default '[]'::jsonb,
  departments jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb
);

create table if not exists public.department_snapshot_history (
  id uuid primary key default gen_random_uuid(),
  department_id text not null,
  department_name text not null,
  import_type text not null default 'current-upload',
  filename text,
  imported_at timestamptz not null default now(),
  period_start text,
  period_end text,
  headers jsonb not null default '[]'::jsonb,
  record_count integer not null default 0,
  sample_records jsonb not null default '[]'::jsonb,
  records jsonb not null default '[]'::jsonb,
  content jsonb not null default '{}'::jsonb
);

create table if not exists public.board_memos (
  id uuid primary key default gen_random_uuid(),
  memo_type text not null default 'board-memo',
  title text not null,
  department_id text,
  department_name text,
  generated_at timestamptz not null default now(),
  created_by text not null default 'Suhas Bhairav',
  website text not null default 'https://suhasbhairav.com',
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.slack_installations (
  id uuid primary key default gen_random_uuid(),
  team_id text not null unique,
  team_name text,
  enterprise_id text,
  enterprise_name text,
  app_id text,
  bot_user_id text,
  bot_access_token text not null,
  scope text,
  authed_user_id text,
  is_active boolean not null default true,
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  content jsonb not null default '{}'::jsonb
);

create table if not exists public.slack_events (
  id uuid primary key default gen_random_uuid(),
  team_id text,
  event_id text unique,
  event_type text,
  channel_id text,
  user_id text,
  event_ts text,
  text text,
  handled boolean not null default false,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.slack_message_snapshots (
  id uuid primary key default gen_random_uuid(),
  team_id text,
  channel_id text not null,
  channel_name text,
  message_ts text not null,
  user_id text,
  text text,
  content jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  unique (channel_id, message_ts)
);

create table if not exists public.department_embeddings (
  id uuid primary key default gen_random_uuid(),
  department_id text not null,
  department_name text not null,
  source_type text not null default 'department_snapshot',
  source_id text,
  chunk_index integer not null default 0,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, source_type, source_id, chunk_index)
);

create table if not exists public.notion_okr_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'notion',
  database_id text not null,
  synced_at timestamptz not null default now(),
  okrs jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.hubspot_deal_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'hubspot',
  portal_id text,
  synced_at timestamptz not null default now(),
  deals jsonb not null default '[]'::jsonb,
  pipelines jsonb not null default '[]'::jsonb,
  owners jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.linear_ticket_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'linear',
  organization_id text,
  organization_name text,
  synced_at timestamptz not null default now(),
  issues jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists department_snapshots_department_id_idx
  on public.department_snapshots (department_id);

create index if not exists department_snapshots_content_gin_idx
  on public.department_snapshots using gin (content);

create index if not exists department_snapshot_history_department_id_idx
  on public.department_snapshot_history (department_id);

create index if not exists department_snapshot_history_imported_at_idx
  on public.department_snapshot_history (imported_at desc);

create index if not exists department_snapshot_history_content_gin_idx
  on public.department_snapshot_history using gin (content);

create index if not exists board_memos_generated_at_idx
  on public.board_memos (generated_at desc);

create index if not exists board_memos_content_gin_idx
  on public.board_memos using gin (content);

create index if not exists slack_installations_active_idx
  on public.slack_installations (is_active, installed_at desc);

create index if not exists slack_events_created_at_idx
  on public.slack_events (created_at desc);

create index if not exists slack_message_snapshots_channel_idx
  on public.slack_message_snapshots (channel_id, captured_at desc);

create index if not exists department_embeddings_department_idx
  on public.department_embeddings (department_id, source_type);

create index if not exists department_embeddings_vector_idx
  on public.department_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists notion_okr_snapshots_synced_at_idx
  on public.notion_okr_snapshots (synced_at desc);

create index if not exists notion_okr_snapshots_content_gin_idx
  on public.notion_okr_snapshots using gin (content);

create index if not exists hubspot_deal_snapshots_synced_at_idx
  on public.hubspot_deal_snapshots (synced_at desc);

create index if not exists hubspot_deal_snapshots_content_gin_idx
  on public.hubspot_deal_snapshots using gin (content);

create index if not exists linear_ticket_snapshots_synced_at_idx
  on public.linear_ticket_snapshots (synced_at desc);

create index if not exists linear_ticket_snapshots_content_gin_idx
  on public.linear_ticket_snapshots using gin (content);

create or replace function public.match_department_embeddings(
  query_embedding vector(1536),
  match_count int default 8,
  department_filter text default null
)
returns table (
  id uuid,
  department_id text,
  department_name text,
  source_type text,
  source_id text,
  chunk_index int,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    de.id,
    de.department_id,
    de.department_name,
    de.source_type,
    de.source_id,
    de.chunk_index,
    de.content,
    de.metadata,
    1 - (de.embedding <=> query_embedding) as similarity
  from public.department_embeddings de
  where department_filter is null or de.department_id = department_filter
  order by de.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists department_snapshots_set_updated_at on public.department_snapshots;
create trigger department_snapshots_set_updated_at
before update on public.department_snapshots
for each row
execute function public.set_updated_at();

drop trigger if exists board_memos_set_updated_at on public.board_memos;
create trigger board_memos_set_updated_at
before update on public.board_memos
for each row
execute function public.set_updated_at();

drop trigger if exists slack_installations_set_updated_at on public.slack_installations;
create trigger slack_installations_set_updated_at
before update on public.slack_installations
for each row
execute function public.set_updated_at();

drop trigger if exists department_embeddings_set_updated_at on public.department_embeddings;
create trigger department_embeddings_set_updated_at
before update on public.department_embeddings
for each row
execute function public.set_updated_at();

alter table public.department_snapshots enable row level security;
alter table public.organization_summaries enable row level security;
alter table public.department_snapshot_history enable row level security;
alter table public.board_memos enable row level security;
alter table public.slack_installations enable row level security;
alter table public.slack_events enable row level security;
alter table public.slack_message_snapshots enable row level security;
alter table public.department_embeddings enable row level security;
alter table public.notion_okr_snapshots enable row level security;
alter table public.hubspot_deal_snapshots enable row level security;
alter table public.linear_ticket_snapshots enable row level security;

grant select, insert, update, delete on public.department_snapshots to service_role;
grant select, insert, update, delete on public.organization_summaries to service_role;
grant select, insert, update, delete on public.department_snapshot_history to service_role;
grant select, insert, update, delete on public.board_memos to service_role;
grant select, insert, update, delete on public.slack_installations to service_role;
grant select, insert, update, delete on public.slack_events to service_role;
grant select, insert, update, delete on public.slack_message_snapshots to service_role;
grant select, insert, update, delete on public.department_embeddings to service_role;
grant select, insert, update, delete on public.notion_okr_snapshots to service_role;
grant select, insert, update, delete on public.hubspot_deal_snapshots to service_role;
grant select, insert, update, delete on public.linear_ticket_snapshots to service_role;
grant execute on function public.match_department_embeddings(vector, int, text) to service_role;
