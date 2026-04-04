-- Run this in your Supabase SQL editor

create table if not exists subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  channel_id text not null,
  channel_name   text not null default '',
  channel_avatar text not null default '',
  created_at timestamptz default now(),
  unique (user_id, channel_id)
);

-- Allow anyone to read/write their own session subscriptions
alter table subscriptions enable row level security;

create policy "select own subscriptions"
  on subscriptions for select using (true);

create policy "insert own subscriptions"
  on subscriptions for insert with check (true);

create policy "delete own subscriptions"
  on subscriptions for delete using (true);
