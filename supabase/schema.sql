create extension if not exists pgcrypto;

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

alter table public.department_snapshots enable row level security;
alter table public.organization_summaries enable row level security;
alter table public.department_snapshot_history enable row level security;
alter table public.board_memos enable row level security;

grant select, insert, update, delete on public.department_snapshots to service_role;
grant select, insert, update, delete on public.organization_summaries to service_role;
grant select, insert, update, delete on public.department_snapshot_history to service_role;
grant select, insert, update, delete on public.board_memos to service_role;
