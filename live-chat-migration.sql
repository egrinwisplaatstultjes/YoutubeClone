-- Run in: Supabase → SQL Editor → New query

create table if not exists live_messages (
  id         uuid        default gen_random_uuid() primary key,
  video_id   text        not null,
  author     text        not null,
  avatar     text,
  body       text        not null,
  is_host    boolean     default false,
  created_at timestamptz default now()
);

create index if not exists live_messages_video_id_idx on live_messages (video_id, created_at);

grant select, insert on live_messages to anon, authenticated;

alter table live_messages enable row level security;
drop policy if exists "Live messages read"  on live_messages;
drop policy if exists "Live messages write" on live_messages;
create policy "Live messages read"  on live_messages for select using (true);
create policy "Live messages write" on live_messages for insert with check (true);
