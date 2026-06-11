create table if not exists public.pdfs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_url text,
  storage_path text,
  file_size bigint,
  page_count integer default 0,
  char_count integer default 0,
  full_text text,
  page_texts jsonb default '[]'::jsonb,
  chunk_count integer default 0,
  created_at timestamptz not null default now()
);

alter table public.pdfs
  add column if not exists storage_path text,
  add column if not exists file_size bigint,
  add column if not exists full_text text,
  add column if not exists page_texts jsonb default '[]'::jsonb,
  add column if not exists chunk_count integer default 0,
  add column if not exists created_at timestamptz not null default now();

alter table public.pdfs enable row level security;

drop policy if exists "Users can read their own PDFs" on public.pdfs;
create policy "Users can read their own PDFs"
  on public.pdfs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own PDFs" on public.pdfs;
create policy "Users can create their own PDFs"
  on public.pdfs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own PDFs" on public.pdfs;
create policy "Users can delete their own PDFs"
  on public.pdfs for delete
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can upload PDFs to their own folder" on storage.objects;
create policy "Users can upload PDFs to their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'pdfs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can read PDFs from their own folder" on storage.objects;
create policy "Users can read PDFs from their own folder"
  on storage.objects for select
  using (
    bucket_id = 'pdfs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete PDFs from their own folder" on storage.objects;
create policy "Users can delete PDFs from their own folder"
  on storage.objects for delete
  using (
    bucket_id = 'pdfs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
