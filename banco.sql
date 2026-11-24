-- MV Upload: execute no Supabase SQL Editor uma vez.

-- Cria o bucket público de uploads.
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do update set public = true;

-- Remove versões antigas das políticas.
drop policy if exists "MV upload public read" on storage.objects;
drop policy if exists "MV upload public insert" on storage.objects;
drop policy if exists "MV upload public update" on storage.objects;
drop policy if exists "MV upload public delete" on storage.objects;

-- Permite uploads e links públicos sem conta.
create policy "MV upload public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'uploads');

create policy "MV upload public insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'uploads');

-- Tabela com os dados dos arquivos.
create table if not exists public.upload_files (
  id uuid primary key,
  name text not null,
  path text not null,
  type text not null default 'application/octet-stream',
  size bigint not null default 0,
  url text not null,
  created_at timestamptz not null default now()
);

-- Garante que novas instalações tenham todas as colunas necessárias.
alter table public.upload_files
  add column if not exists name text,
  add column if not exists path text,
  add column if not exists type text,
  add column if not exists size bigint,
  add column if not exists url text,
  add column if not exists created_at timestamptz;

alter table public.upload_files alter column created_at set default now();

alter table public.upload_files enable row level security;

drop policy if exists "MV upload public metadata read" on public.upload_files;
drop policy if exists "MV upload public metadata insert" on public.upload_files;

drop policy if exists "MV upload public metadata update" on public.upload_files;
drop policy if exists "MV upload public metadata delete" on public.upload_files;

create policy "MV upload public metadata read"
  on public.upload_files for select
  to anon, authenticated
  using (true);

create policy "MV upload public metadata insert"
  on public.upload_files for insert
  to anon, authenticated
  with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert on public.upload_files to anon, authenticated;
