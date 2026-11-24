-- Execute no SQL Editor do Supabase uma vez.
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do update set public = true;

drop policy if exists "MV upload public read" on storage.objects;
drop policy if exists "MV upload public insert" on storage.objects;

create policy "MV upload public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'uploads');

create policy "MV upload public insert"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'uploads');

create table if not exists public.upload_files (
  id uuid primary key,
  name text not null,
  path text not null,
  type text not null default 'application/octet-stream',
  size bigint not null default 0,
  url text not null,
  created_at timestamptz not null default now()
);

alter table public.upload_files enable row level security;

drop policy if exists "MV upload metadata read" on public.upload_files;
drop policy if exists "MV upload metadata insert" on public.upload_files;

create policy "MV upload metadata read"
  on public.upload_files for select to anon, authenticated
  using (true);

create policy "MV upload metadata insert"
  on public.upload_files for insert to anon, authenticated
  with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert on public.upload_files to anon, authenticated;
