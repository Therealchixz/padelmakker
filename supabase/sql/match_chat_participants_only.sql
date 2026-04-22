-- Tighten match chat access:
-- Only players registered in match_players can read/write match chat.
-- Run this if add_match_chat.sql was already executed earlier.

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
