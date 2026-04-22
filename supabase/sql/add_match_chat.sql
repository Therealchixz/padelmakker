-- Match chat for 2v2 matches
-- Run in Supabase SQL editor.

create table if not exists public.match_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null default '',
  sender_avatar text,
  content text not null,
  created_at timestamptz not null default now(),
  constraint match_messages_content_len_chk
    check (char_length(btrim(content)) between 1 and 1000)
);

alter table public.match_messages
  add column if not exists sender_name text not null default '';

alter table public.match_messages
  add column if not exists sender_avatar text;

create index if not exists idx_match_messages_match_id_created_at
  on public.match_messages (match_id, created_at);

create index if not exists idx_match_messages_sender_id
  on public.match_messages (sender_id);

alter table public.match_messages enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.match_messages';
  end if;
end $$;

drop policy if exists match_messages_select_participants on public.match_messages;
create policy match_messages_select_participants
  on public.match_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.match_players mp
      where mp.match_id = match_messages.match_id
        and mp.user_id = (select auth.uid())
    )
  );

drop policy if exists match_messages_insert_participants on public.match_messages;
create policy match_messages_insert_participants
  on public.match_messages
  for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and char_length(btrim(content)) between 1 and 1000
    and exists (
      select 1
      from public.match_players mp
      where mp.match_id = match_messages.match_id
        and mp.user_id = (select auth.uid())
    )
  );

drop policy if exists match_messages_delete_own_or_admin on public.match_messages;
create policy match_messages_delete_own_or_admin
  on public.match_messages
  for delete
  to authenticated
  using (
    sender_id = (select auth.uid())
    or public.is_admin()
  );
