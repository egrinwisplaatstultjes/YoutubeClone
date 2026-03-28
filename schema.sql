-- ═══════════════════════════════════════════════════════════════════════════
-- Run this in: Supabase → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Videos ──────────────────────────────────────────────────────────────────
create table if not exists videos (
  id          text primary key,
  title       text        not null,
  channel     text        not null,
  channel_id  text,
  avatar      text,
  thumbnail   text,
  video_url   text,
  views       text        default '0',
  duration    text        default '0:00',
  category    text        default 'All',
  tags        text[]      default '{}',
  subscribers text        default '0',
  verified    boolean     default false,
  description text        default '',
  is_own      boolean     default false,
  created_at  timestamptz default now()
);

grant select, insert, update, delete on videos to anon, authenticated;

alter table videos enable row level security;
drop policy if exists "Public videos read"   on videos;
drop policy if exists "Public videos insert" on videos;
drop policy if exists "Public videos update" on videos;
drop policy if exists "Public videos delete" on videos;
create policy "Public videos read"   on videos for select using (true);
create policy "Public videos insert" on videos for insert with check (true);
create policy "Public videos update" on videos for update using (true);
create policy "Public videos delete" on videos for delete using (true);

-- ── Likes ────────────────────────────────────────────────────────────────────
create table if not exists likes (
  video_id   text not null,
  session_id text not null,
  created_at timestamptz default now(),
  primary key (video_id, session_id)
);

grant select, insert, delete on likes to anon, authenticated;

alter table likes enable row level security;
drop policy if exists "Public likes read"   on likes;
drop policy if exists "Public likes write"  on likes;
drop policy if exists "Public likes delete" on likes;
create policy "Public likes read"   on likes for select using (true);
create policy "Public likes write"  on likes for insert with check (true);
create policy "Public likes delete" on likes for delete using (true);

-- ── Comments ─────────────────────────────────────────────────────────────────
create table if not exists comments (
  id         uuid default gen_random_uuid() primary key,
  video_id   text        not null,
  author     text        not null default 'You',
  avatar     text,
  body       text        not null,
  created_at timestamptz default now()
);

grant select, insert on comments to anon, authenticated;

alter table comments enable row level security;
drop policy if exists "Public comments read"  on comments;
drop policy if exists "Public comments write" on comments;
create policy "Public comments read"  on comments for select using (true);
create policy "Public comments write" on comments for insert with check (true);

-- ── Seed: 12 starter videos ───────────────────────────────────────────────────
insert into videos (id, title, channel, channel_id, avatar, thumbnail, video_url, views, duration, category, tags, subscribers, verified, description, created_at)
values
  ('1',  'Building a Full-Stack App with React & Node.js in 2025',
         'CodeWithAlex', 'c1', 'https://i.pravatar.cc/40?img=1',
         'https://picsum.photos/seed/v1/640/360',
         'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
         '1.2M', '42:18', 'Tech', ARRAY['focused','curious'], '892K', true,
         'Build a complete full-stack app from scratch using React, Node.js, and PostgreSQL. We cover auth, databases, and deployment.',
         NOW() - INTERVAL '3 days'),

  ('2',  'Lo-Fi Beats to Study / Relax 🎵 — 24/7 Live Stream',
         'ChillVibes', 'c2', 'https://i.pravatar.cc/40?img=2',
         'https://picsum.photos/seed/v2/640/360',
         'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
         '4.8M', 'LIVE', 'Music', ARRAY['chill','focused'], '2.1M', true,
         'Your daily dose of chill lo-fi music to help you focus and relax. No ads, no interruptions.',
         NOW() - INTERVAL '7 days'),

  ('3',  'I Spent 30 Days Mastering Unreal Engine 5 — Here''s What Happened',
         'GameDevJourney', 'c3', 'https://i.pravatar.cc/40?img=3',
         'https://picsum.photos/seed/v3/640/360',
         'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
         '882K', '28:44', 'Gaming', ARRAY['curious','energized'], '430K', false,
         '30-day challenge learning Unreal Engine 5 from zero to a playable demo game.',
         NOW() - INTERVAL '5 days'),

  ('4',  'Exploring Tokyo''s Hidden Neighborhoods at Night',
         'WanderLens', 'c4', 'https://i.pravatar.cc/40?img=4',
         'https://picsum.photos/seed/v4/640/360',
         'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
         '2.3M', '19:05', 'Travel', ARRAY['chill','curious'], '1.5M', true,
         'A cinematic walk through Tokyo''s lesser-known nightlife districts.',
         NOW() - INTERVAL '14 days'),

  ('5',  'Why the Universe is Weirder Than You Think — Quantum Gravity',
         'CosmosUnlocked', 'c5', 'https://i.pravatar.cc/40?img=5',
         'https://picsum.photos/seed/v5/640/360',
         'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
         '3.1M', '35:22', 'Science', ARRAY['curious','focused'], '4.2M', true,
         'A deep dive into quantum gravity and why it challenges everything we know about reality.',
         NOW() - INTERVAL '30 days'),

  ('6',  'Pasta Masterclass — 5 Restaurant Recipes in 20 Minutes',
         'KitchenMasters', 'c6', 'https://i.pravatar.cc/40?img=6',
         'https://picsum.photos/seed/v6/640/360',
         'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
         '5.6M', '21:47', 'Cooking', ARRAY['chill','energized'], '6.8M', true,
         'Five incredible pasta recipes anyone can make at home in under 20 minutes.',
         NOW() - INTERVAL '21 days'),

  ('7',  'MacBook Pro M4 Full Review — Is It Worth the Upgrade?',
         'TechRadar', 'c7', 'https://i.pravatar.cc/40?img=7',
         'https://picsum.photos/seed/v7/640/360',
         'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
         '1.9M', '16:30', 'Tech', ARRAY['curious','focused'], '3.3M', true,
         'We put the M4 MacBook Pro through its paces. Benchmarks, real-world use, and is it worth upgrading?',
         NOW() - INTERVAL '4 days'),

  ('8',  'NBA Top 50 Plays of the Season 🏀',
         'HoopsVault', 'c8', 'https://i.pravatar.cc/40?img=8',
         'https://picsum.photos/seed/v8/640/360',
         'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
         '7.2M', '12:55', 'Sports', ARRAY['energized','hype'], '5.1M', true,
         'The most jaw-dropping 50 plays from this NBA season compiled into one video.',
         NOW() - INTERVAL '6 days'),

  ('9',  'Minimalist Room Makeover on a $200 Budget',
         'DesignByYou', 'c9', 'https://i.pravatar.cc/40?img=9',
         'https://picsum.photos/seed/v9/640/360',
         'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
         '912K', '24:10', 'Education', ARRAY['chill','curious'], '780K', false,
         'Transforming a bland bedroom into a minimalist paradise on a tight $200 budget.',
         NOW() - INTERVAL '2 days'),

  ('10', '"Absolutely Ridiculous" — Full Stand-Up Comedy Special',
         'LaughFactory', 'c10', 'https://i.pravatar.cc/40?img=10',
         'https://picsum.photos/seed/v10/640/360',
         'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
         '11.4M', '1:02:33', 'Comedy', ARRAY['hype','energized'], '9.2M', true,
         'A full stand-up comedy special that had audiences in tears from start to finish.',
         NOW() - INTERVAL '30 days'),

  ('11', 'Learning Rust in 2025 — The Hard Parts Nobody Talks About',
         'CodeWithAlex', 'c1', 'https://i.pravatar.cc/40?img=1',
         'https://picsum.photos/seed/v11/640/360',
         'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
         '654K', '38:05', 'Tech', ARRAY['focused','curious'], '892K', true,
         'Ownership, lifetimes, and async in Rust — the parts that trip everyone up and how to actually get them.',
         NOW() - INTERVAL '7 days'),

  ('12', 'Surfing the Biggest Waves in Portugal — Nazaré 2025',
         'WaveRiders', 'c12', 'https://i.pravatar.cc/40?img=12',
         'https://picsum.photos/seed/v12/640/360',
         'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
         '3.4M', '09:48', 'Sports', ARRAY['energized','hype'], '2.7M', true,
         'Chasing 30-meter waves at Nazaré, the big-wave surfing capital of the world.',
         NOW() - INTERVAL '5 days')

on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- STORAGE — do this manually in the Supabase dashboard:
--   1. Go to Storage → New bucket
--   2. Name it exactly:  media
--   3. Toggle "Public bucket" ON
--   4. Click Create
-- ═══════════════════════════════════════════════════════════════════════════
