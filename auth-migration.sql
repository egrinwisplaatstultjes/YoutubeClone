-- ═══════════════════════════════════════════════════════════════════════════
-- AUTH MIGRATION — run in Supabase → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add user_id column to videos (links to Supabase Auth users)
alter table videos
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- 2. Secure video insert: only authenticated users can upload
drop policy if exists "Public videos insert" on videos;
create policy "Authenticated users can insert videos" on videos
  for insert
  with check (auth.uid() is not null and auth.uid() = user_id);

-- 3. Only the owner can update/delete their videos
drop policy if exists "Public videos update" on videos;
drop policy if exists "Public videos delete" on videos;
create policy "Owner can update video" on videos
  for update
  using (auth.uid() = user_id);
create policy "Owner can delete video" on videos
  for delete
  using (auth.uid() = user_id);

-- 4. Anyone can still read all videos (no change)
-- "Public videos read" policy already exists with using (true)

-- 5. Add user_id to comments so authenticated users own their comments
alter table comments
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- 6. Secure comment insert: must be authenticated
drop policy if exists "Public comments write" on comments;
create policy "Authenticated users can comment" on comments
  for insert
  with check (auth.uid() is not null and auth.uid() = user_id);

-- 7. Owner can delete their own comments
drop policy if exists "Owner can delete comment" on comments;
create policy "Owner can delete comment" on comments
  for delete
  using (auth.uid() = user_id);

-- 8. Make sure authenticated role has necessary grants
grant select, insert, update, delete on videos   to authenticated;
grant select, insert, delete         on comments  to authenticated;
