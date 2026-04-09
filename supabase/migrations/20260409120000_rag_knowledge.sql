-- Enable pgvector extension
create extension if not exists vector;

-- Table: knowledge_documents
create table if not exists knowledge_documents (
  id          uuid primary key default gen_random_uuid(),
  artisan_id  uuid not null references auth.users(id) on delete cascade,
  nom         text not null,
  type_fichier text not null,             -- pdf, xlsx, docx, txt
  statut      text not null default 'en_cours', -- en_cours | indexe | erreur
  storage_path text,
  created_at  timestamptz not null default now()
);

alter table knowledge_documents enable row level security;

drop policy if exists "artisan_own_knowledge_documents" on knowledge_documents;
create policy "artisan_own_knowledge_documents"
  on knowledge_documents for all
  using (auth.uid() = artisan_id)
  with check (auth.uid() = artisan_id);

-- Table: knowledge_chunks
create table if not exists knowledge_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references knowledge_documents(id) on delete cascade,
  artisan_id  uuid not null references auth.users(id) on delete cascade,
  contenu     text not null,
  embedding   vector(1536),
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

alter table knowledge_chunks enable row level security;

drop policy if exists "artisan_own_knowledge_chunks" on knowledge_chunks;
create policy "artisan_own_knowledge_chunks"
  on knowledge_chunks for all
  using (auth.uid() = artisan_id)
  with check (auth.uid() = artisan_id);

-- IVFFlat index for cosine similarity search
create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- RPC function for cosine similarity search (bypasses RLS vec ops limitation)
create or replace function search_knowledge_chunks(
  p_artisan_id  uuid,
  p_embedding   vector(1536),
  p_limit       int default 5
)
returns table (
  id          uuid,
  document_id uuid,
  contenu     text,
  metadata    jsonb,
  similarity  float
)
language sql stable
security definer
set search_path = public
as $$
  select
    kc.id,
    kc.document_id,
    kc.contenu,
    kc.metadata,
    1 - (kc.embedding <=> p_embedding) as similarity
  from knowledge_chunks kc
  where kc.artisan_id = p_artisan_id
    and kc.embedding is not null
  order by kc.embedding <=> p_embedding
  limit p_limit;
$$;
