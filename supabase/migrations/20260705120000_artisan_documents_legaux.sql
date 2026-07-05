create table public.artisan_documents_legaux (
  id uuid primary key default gen_random_uuid(),
  artisan_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('decennale','urssaf')),
  storage_path text not null,
  nom_fichier text not null,
  uploaded_at timestamptz not null default now(),
  unique (artisan_id, type)
);

alter table public.artisan_documents_legaux enable row level security;

create policy "artisan_manage_own_legal_docs" on public.artisan_documents_legaux
  for all using (auth.uid() = artisan_id) with check (auth.uid() = artisan_id);

create policy "client_read_linked_artisan_legal_docs" on public.artisan_documents_legaux
  for select using (
    exists (
      select 1 from public.clients c
      where c.artisan_id = artisan_documents_legaux.artisan_id
        and c.auth_user_id = auth.uid()
    )
  );
