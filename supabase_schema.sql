-- =============================================================================
-- FLUX CLOUD STORAGE - SUPABASE DATABASE SCHEMA
-- Copy and paste this into Supabase Dashboard -> SQL Editor -> Run
-- =============================================================================

-- 1. Folders Table
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.folders(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Files Table
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references public.folders(id) on delete cascade,
  original_name text not null,
  stored_name text not null,
  storage_path text,
  mime_type text,
  size_bytes bigint default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Settings Table
create table if not exists public.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- 4. Activity Logs Table
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  detail text,
  ip text,
  created_at timestamptz default now()
);

-- 5. Seed Default Folders
insert into public.folders (name, parent_id)
select 'Software', null
where not exists (select 1 from public.folders where name = 'Software');

insert into public.folders (name, parent_id)
select 'Operating System', null
where not exists (select 1 from public.folders where name = 'Operating System');

insert into public.folders (name, parent_id)
select 'Codebase / Projects', null
where not exists (select 1 from public.folders where name = 'Codebase / Projects');

-- 6. Seed Default Quota (500 MB)
insert into public.settings (key, value)
values ('max_storage_bytes', '524288000')
on conflict (key) do nothing;

-- 7. Enable Row Level Security (RLS)
alter table public.folders enable row level security;
alter table public.files enable row level security;
alter table public.settings enable row level security;
alter table public.activity_logs enable row level security;

-- 8. Policies allowing authenticated users full access
drop policy if exists "Authenticated users full access to folders" on public.folders;
create policy "Authenticated users full access to folders" on public.folders for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users full access to files" on public.files;
create policy "Authenticated users full access to files" on public.files for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users full access to settings" on public.settings;
create policy "Authenticated users full access to settings" on public.settings for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users full access to activity_logs" on public.activity_logs;
create policy "Authenticated users full access to activity_logs" on public.activity_logs for all to authenticated using (true) with check (true);
