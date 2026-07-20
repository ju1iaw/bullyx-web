-- Bullyx Company Brain: conversations, indexed knowledge, feedback, and agent work.
create extension if not exists vector;

create or replace function public.is_organization_member(target_organization uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_organization and user_id = auth.uid()
  );
$$;

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  source_id text,
  source_label text not null default 'Manual knowledge',
  external_id text,
  external_url text,
  title text not null check (char_length(title) between 1 and 300),
  kind text not null default 'document',
  content text not null,
  content_hash text,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector,
  search_vector tsvector generated always as (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,''))) stored,
  indexed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_id, external_id)
);
create index if not exists knowledge_documents_search_idx on public.knowledge_documents using gin(search_vector);
create index if not exists knowledge_documents_org_idx on public.knowledge_documents(organization_id, indexed_at desc);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'New question',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_owner_idx on public.conversations(created_by, organization_id, updated_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  model text,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);

create table if not exists public.answer_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  correction text,
  preferred_format text,
  created_at timestamptz not null default now(),
  unique(message_id, created_by)
);

create table if not exists public.agent_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  title text not null,
  agent_name text not null,
  instructions text not null,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','awaiting_approval','completed','failed','cancelled')),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_assignments_org_idx on public.agent_assignments(organization_id, created_at desc);

alter table public.knowledge_documents enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.answer_feedback enable row level security;
alter table public.agent_assignments enable row level security;

create policy "members read company knowledge" on public.knowledge_documents for select to authenticated using (public.is_organization_member(organization_id));
create policy "members add company knowledge" on public.knowledge_documents for insert to authenticated with check (public.is_organization_member(organization_id) and created_by = auth.uid());
create policy "authors update company knowledge" on public.knowledge_documents for update to authenticated using (created_by = auth.uid() or public.is_organization_admin(organization_id));
create policy "users read own conversations" on public.conversations for select to authenticated using (created_by = auth.uid() and public.is_organization_member(organization_id));
create policy "users create own conversations" on public.conversations for insert to authenticated with check (created_by = auth.uid() and public.is_organization_member(organization_id));
create policy "users update own conversations" on public.conversations for update to authenticated using (created_by = auth.uid());
create policy "users read own messages" on public.messages for select to authenticated using (exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid()));
create policy "users add feedback" on public.answer_feedback for insert to authenticated with check (created_by = auth.uid() and exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id where m.id = message_id and c.created_by = auth.uid()));
create policy "users update own feedback" on public.answer_feedback for update to authenticated using (created_by = auth.uid());
create policy "members read agent work" on public.agent_assignments for select to authenticated using (public.is_organization_member(organization_id));
create policy "members assign agent work" on public.agent_assignments for insert to authenticated with check (created_by = auth.uid() and public.is_organization_member(organization_id));
create policy "owners update agent work" on public.agent_assignments for update to authenticated using (created_by = auth.uid() or public.is_organization_admin(organization_id));

create or replace function public.search_company_documents(query_text text, target_organization uuid, match_count integer default 8)
returns table (id uuid, title text, kind text, source_label text, external_url text, content text, metadata jsonb, rank real)
language sql stable security invoker set search_path = public as $$
  select d.id, d.title, d.kind, d.source_label, d.external_url,
    left(d.content, 6000) as content, d.metadata,
    ts_rank_cd(d.search_vector, websearch_to_tsquery('english', query_text)) as rank
  from public.knowledge_documents d
  where d.organization_id = target_organization
    and d.search_vector @@ websearch_to_tsquery('english', query_text)
  order by rank desc, d.indexed_at desc
  limit least(greatest(match_count, 1), 12);
$$;

grant execute on function public.search_company_documents(text, uuid, integer) to authenticated;
