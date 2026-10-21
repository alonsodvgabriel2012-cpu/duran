-- Pega todo esto en Supabase > SQL Editor > Run (una sola vez).
create table if not exists public.projects (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text, status text, state jsonb, inputs jsonb,
  size bigint default 0, updated_at timestamptz default now(),
  primary key (user_id, id)
);
alter table public.projects enable row level security;
drop policy if exists "own projects" on public.projects;
create policy "own projects" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('media', 'media', false) on conflict (id) do nothing;
drop policy if exists "media select" on storage.objects;
drop policy if exists "media insert" on storage.objects;
drop policy if exists "media update" on storage.objects;
drop policy if exists "media delete" on storage.objects;
create policy "media select" on storage.objects for select using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media insert" on storage.objects for insert with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media update" on storage.objects for update using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media delete" on storage.objects for delete using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
