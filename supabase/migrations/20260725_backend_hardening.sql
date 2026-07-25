-- Backend hardening for an existing Bullyx installation.
-- Run after schema.sql and 20260719_company_brain.sql.

-- Tenant identifiers are immutable after insert, including for users who belong
-- to more than one organization.
create or replace function public.prevent_organization_reassignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists knowledge_documents_organization_immutable on public.knowledge_documents;
create trigger knowledge_documents_organization_immutable
  before update of organization_id on public.knowledge_documents
  for each row execute function public.prevent_organization_reassignment();

drop trigger if exists conversations_organization_immutable on public.conversations;
create trigger conversations_organization_immutable
  before update of organization_id on public.conversations
  for each row execute function public.prevent_organization_reassignment();

drop trigger if exists agent_assignments_organization_immutable on public.agent_assignments;
create trigger agent_assignments_organization_immutable
  before update of organization_id on public.agent_assignments
  for each row execute function public.prevent_organization_reassignment();

-- Updates must still satisfy the current tenant and record-owner rules.
drop policy if exists "authors update company knowledge" on public.knowledge_documents;
create policy "authors update company knowledge" on public.knowledge_documents for update to authenticated
  using (created_by = auth.uid() or public.is_organization_admin(organization_id))
  with check (public.is_organization_member(organization_id) and (created_by = auth.uid() or public.is_organization_admin(organization_id)));

drop policy if exists "users update own conversations" on public.conversations;
create policy "users update own conversations" on public.conversations for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid() and public.is_organization_member(organization_id));

drop policy if exists "users update own feedback" on public.answer_feedback;
create policy "users update own feedback" on public.answer_feedback for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid() and exists (
    select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
    where m.id = message_id and c.created_by = auth.uid()
  ));

drop policy if exists "users read own feedback" on public.answer_feedback;
create policy "users read own feedback" on public.answer_feedback for select to authenticated
  using (created_by = auth.uid() and exists (
    select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
    where m.id = message_id and c.created_by = auth.uid()
  ));

drop policy if exists "owners update agent work" on public.agent_assignments;
create policy "owners update agent work" on public.agent_assignments for update to authenticated
  using (created_by = auth.uid() or public.is_organization_admin(organization_id))
  with check (public.is_organization_member(organization_id) and (created_by = auth.uid() or public.is_organization_admin(organization_id)));

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Users may inspect their own memberships; organization admins may inspect the
-- memberships they manage. This replaces the original table-wide read policy.
drop policy if exists "memberships readable by signed in users" on public.organization_members;
create policy "memberships readable when relevant" on public.organization_members for select to authenticated
  using (user_id = auth.uid() or public.is_organization_admin(organization_id));

-- Keep retrieval fail-closed even if the function execution context changes.
create or replace function public.search_company_documents(query_text text, target_organization uuid, match_count integer default 8)
returns table (id uuid, title text, kind text, source_label text, external_url text, content text, metadata jsonb, rank real)
language sql stable security invoker set search_path = public as $$
  select d.id, d.title, d.kind, d.source_label, d.external_url,
    left(d.content, 6000) as content, d.metadata,
    ts_rank_cd(d.search_vector, websearch_to_tsquery('english', query_text)) as rank
  from public.knowledge_documents d
  where public.is_organization_member(target_organization)
    and d.organization_id = target_organization
    and d.search_vector @@ websearch_to_tsquery('english', query_text)
  order by rank desc, d.indexed_at desc
  limit least(greatest(match_count, 1), 12);
$$;
