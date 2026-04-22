-- Chat performance indexes for direct messages (public.messages)
-- Safe to run multiple times.

-- Fast retrieval of a specific conversation in chronological order.
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver_created_at
ON public.messages (sender_id, receiver_id, created_at DESC);

-- Supports the inverse side of the conversation pair.
CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender_created_at
ON public.messages (receiver_id, sender_id, created_at DESC);

-- Speeds up unread lookups and mark-as-read updates.
CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender_unread
ON public.messages (receiver_id, sender_id)
WHERE is_read = false;
