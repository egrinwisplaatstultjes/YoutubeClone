-- Run this in your Supabase SQL editor

-- Add parent_id to comments for replies
alter table comments add column if not exists parent_id uuid references comments(id) on delete cascade;

-- Comment votes table (likes/dislikes on comments)
create table if not exists comment_votes (
  id         uuid primary key default gen_random_uuid(),
  comment_id uuid not null references comments(id) on delete cascade,
  user_id    text not null,
  vote       text not null check (vote in ('up', 'down')),
  created_at timestamptz default now(),
  unique (comment_id, user_id)
);

alter table comment_votes enable row level security;

create policy "anyone can read comment votes"   on comment_votes for select using (true);
create policy "anyone can insert comment votes"  on comment_votes for insert with check (true);
create policy "anyone can update comment votes"  on comment_votes for update using (true);
create policy "anyone can delete comment votes"  on comment_votes for delete using (true);
