// Free public sample videos from Google's GTV bucket
const VIDEOS = {
  v1: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  v2: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  v3: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  v4: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  v5: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  v6: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  v7: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  v8: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
  v9: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  v10:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
  v11:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
  v12:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
}

export const categories = ['All','Gaming','Music','Tech','Sports','Cooking','Travel','Science','Comedy','Education']

export const videos = [
  { id:'1',  title:'Building a Full-Stack App with React & Node.js in 2025', channel:'CodeWithAlex',  channelId:'c1',  avatar:'https://i.pravatar.cc/40?img=1',  thumbnail:'https://picsum.photos/seed/v1/640/360',  videoUrl: VIDEOS.v1,  views:'1.2M', timeAgo:'3 days ago',   duration:'42:18',    category:'Tech',      tags:['focused','curious'],   subscribers:'892K', verified:true,  description:'Build a complete full-stack app from scratch using React, Node.js, and PostgreSQL. We cover auth, databases, and deployment.', likes:'48K',  comments:1240 },
  { id:'2',  title:'Lo-Fi Beats to Study / Relax 🎵 — 24/7 Live Stream',    channel:'ChillVibes',   channelId:'c2',  avatar:'https://i.pravatar.cc/40?img=2',  thumbnail:'https://picsum.photos/seed/v2/640/360',  videoUrl: VIDEOS.v2,  views:'4.8M', timeAgo:'1 week ago',   duration:'LIVE',     category:'Music',     tags:['chill','focused'],     subscribers:'2.1M', verified:true,  description:'Your daily dose of chill lo-fi music to help you focus and relax. No ads, no interruptions.',                                 likes:'120K', comments:5800 },
  { id:'3',  title:"I Spent 30 Days Mastering Unreal Engine 5 — Here's What Happened", channel:'GameDevJourney',channelId:'c3',avatar:'https://i.pravatar.cc/40?img=3',thumbnail:'https://picsum.photos/seed/v3/640/360',videoUrl:VIDEOS.v3, views:'882K', timeAgo:'5 days ago',   duration:'28:44',    category:'Gaming',    tags:['curious','energized'], subscribers:'430K', verified:false, description:'30-day challenge learning Unreal Engine 5 from zero to a playable demo game.',                                                likes:'32K',  comments:890  },
  { id:'4',  title:"Exploring Tokyo's Hidden Neighborhoods at Night",         channel:'WanderLens',   channelId:'c4',  avatar:'https://i.pravatar.cc/40?img=4',  thumbnail:'https://picsum.photos/seed/v4/640/360',  videoUrl: VIDEOS.v4,  views:'2.3M', timeAgo:'2 weeks ago',  duration:'19:05',    category:'Travel',    tags:['chill','curious'],     subscribers:'1.5M', verified:true,  description:"A cinematic walk through Tokyo's lesser-known nightlife districts.",                                                           likes:'87K',  comments:2100 },
  { id:'5',  title:'Why the Universe is Weirder Than You Think — Quantum Gravity', channel:'CosmosUnlocked',channelId:'c5',avatar:'https://i.pravatar.cc/40?img=5',thumbnail:'https://picsum.photos/seed/v5/640/360',videoUrl:VIDEOS.v5, views:'3.1M', timeAgo:'1 month ago',  duration:'35:22',    category:'Science',   tags:['curious','focused'],   subscribers:'4.2M', verified:true,  description:'A deep dive into quantum gravity and why it challenges everything we know about reality.',                                     likes:'142K', comments:7300 },
  { id:'6',  title:'Pasta Masterclass — 5 Restaurant Recipes in 20 Minutes',  channel:'KitchenMasters',channelId:'c6', avatar:'https://i.pravatar.cc/40?img=6',  thumbnail:'https://picsum.photos/seed/v6/640/360',  videoUrl: VIDEOS.v6,  views:'5.6M', timeAgo:'3 weeks ago',  duration:'21:47',    category:'Cooking',   tags:['chill','energized'],   subscribers:'6.8M', verified:true,  description:'Five incredible pasta recipes anyone can make at home in under 20 minutes.',                                                    likes:'210K', comments:9400 },
  { id:'7',  title:'MacBook Pro M4 Full Review — Is It Worth the Upgrade?',   channel:'TechRadar',    channelId:'c7',  avatar:'https://i.pravatar.cc/40?img=7',  thumbnail:'https://picsum.photos/seed/v7/640/360',  videoUrl: VIDEOS.v7,  views:'1.9M', timeAgo:'4 days ago',   duration:'16:30',    category:'Tech',      tags:['curious','focused'],   subscribers:'3.3M', verified:true,  description:'We put the M4 MacBook Pro through its paces. Benchmarks, real-world use, and is it worth upgrading?',                         likes:'75K',  comments:3200 },
  { id:'8',  title:'NBA Top 50 Plays of the Season 🏀',                       channel:'HoopsVault',   channelId:'c8',  avatar:'https://i.pravatar.cc/40?img=8',  thumbnail:'https://picsum.photos/seed/v8/640/360',  videoUrl: VIDEOS.v8,  views:'7.2M', timeAgo:'6 days ago',   duration:'12:55',    category:'Sports',    tags:['energized','hype'],    subscribers:'5.1M', verified:true,  description:'The most jaw-dropping 50 plays from this NBA season compiled into one video.',                                                 likes:'290K', comments:14200},
  { id:'9',  title:'Minimalist Room Makeover on a $200 Budget',               channel:'DesignByYou',  channelId:'c9',  avatar:'https://i.pravatar.cc/40?img=9',  thumbnail:'https://picsum.photos/seed/v9/640/360',  videoUrl: VIDEOS.v9,  views:'912K', timeAgo:'2 days ago',   duration:'24:10',    category:'Education', tags:['chill','curious'],     subscribers:'780K', verified:false, description:'Transforming a bland bedroom into a minimalist paradise on a tight $200 budget.',                                              likes:'41K',  comments:1680 },
  { id:'10', title:'"Absolutely Ridiculous" — Full Stand-Up Comedy Special',  channel:'LaughFactory', channelId:'c10', avatar:'https://i.pravatar.cc/40?img=10', thumbnail:'https://picsum.photos/seed/v10/640/360', videoUrl: VIDEOS.v10, views:'11.4M',timeAgo:'1 month ago',  duration:'1:02:33',  category:'Comedy',    tags:['hype','energized'],    subscribers:'9.2M', verified:true,  description:'A full stand-up comedy special that had audiences in tears from start to finish.',                                             likes:'520K', comments:28000},
  { id:'11', title:'Learning Rust in 2025 — The Hard Parts Nobody Talks About',channel:'CodeWithAlex',channelId:'c1', avatar:'https://i.pravatar.cc/40?img=1',  thumbnail:'https://picsum.photos/seed/v11/640/360', videoUrl: VIDEOS.v11, views:'654K', timeAgo:'1 week ago',   duration:'38:05',    category:'Tech',      tags:['focused','curious'],   subscribers:'892K', verified:true,  description:"Ownership, lifetimes, and async in Rust — the parts that trip everyone up and how to actually get them.",                    likes:'29K',  comments:1100 },
  { id:'12', title:'Surfing the Biggest Waves in Portugal — Nazaré 2025',     channel:'WaveRiders',   channelId:'c12', avatar:'https://i.pravatar.cc/40?img=12', thumbnail:'https://picsum.photos/seed/v12/640/360', videoUrl: VIDEOS.v12, views:'3.4M', timeAgo:'5 days ago',   duration:'09:48',    category:'Sports',    tags:['energized','hype'],    subscribers:'2.7M', verified:true,  description:"Chasing 30-meter waves at Nazaré, the big-wave surfing capital of the world.",                                               likes:'163K', comments:6700 },
]

export const shorts = [
  { id:'s1', title:'This one coding trick saves you hours every week 🔥', channel:'CodeWithAlex', channelId:'c1', avatar:'https://i.pravatar.cc/40?img=1', thumbnail:'https://picsum.photos/seed/sh1/400/711', videoUrl:VIDEOS.v3, duration:'0:47', views:2100000, likes:89000, category:'Tech' },
  { id:'s2', title:'Tokyo at 3am hits different 🌙✨', channel:'WanderLens', channelId:'c4', avatar:'https://i.pravatar.cc/40?img=4', thumbnail:'https://picsum.photos/seed/sh2/400/711', videoUrl:VIDEOS.v4, duration:'0:58', views:4800000, likes:212000, category:'Travel' },
  { id:'s3', title:'POV: you just understood async/await 😂', channel:'CodeWithAlex', channelId:'c1', avatar:'https://i.pravatar.cc/40?img=1', thumbnail:'https://picsum.photos/seed/sh3/400/711', videoUrl:VIDEOS.v5, duration:'0:52', views:880000, likes:41000, category:'Tech' },
  { id:'s4', title:'NBA play of the year 🏀🔥', channel:'HoopsVault', channelId:'c8', avatar:'https://i.pravatar.cc/40?img=8', thumbnail:'https://picsum.photos/seed/sh4/400/711', videoUrl:VIDEOS.v6, duration:'0:31', views:7200000, likes:340000, category:'Sports' },
  { id:'s5', title:'5 pasta hacks chefs don\'t want you to know', channel:'KitchenMasters', channelId:'c6', avatar:'https://i.pravatar.cc/40?img=6', thumbnail:'https://picsum.photos/seed/sh5/400/711', videoUrl:VIDEOS.v7, duration:'0:55', views:3300000, likes:156000, category:'Cooking' },
  { id:'s6', title:'Why quantum computers will break encryption 😰', channel:'CosmosUnlocked', channelId:'c5', avatar:'https://i.pravatar.cc/40?img=5', thumbnail:'https://picsum.photos/seed/sh6/400/711', videoUrl:VIDEOS.v8, duration:'0:49', views:5600000, likes:267000, category:'Science' },
  { id:'s7', title:'Minimal desk setup for $80 total 🖥️', channel:'DesignByYou', channelId:'c9', avatar:'https://i.pravatar.cc/40?img=9', thumbnail:'https://picsum.photos/seed/sh7/400/711', videoUrl:VIDEOS.v9, duration:'0:44', views:1200000, likes:67000, category:'Education' },
]

export const comments = [
  { id:1, user:'PixelNerd42',   avatar:'https://i.pravatar.cc/32?img=11', text:"This is genuinely one of the best explanations I've seen. Keep it up!", likes:342, timeAgo:'2 days ago' },
  { id:2, user:'NightOwlCoder', avatar:'https://i.pravatar.cc/32?img=12', text:"I've been waiting for this video for so long. Worth every second.",     likes:128, timeAgo:'3 days ago' },
  { id:3, user:'SolaraDev',     avatar:'https://i.pravatar.cc/32?img=13', text:"The part at 12:34 literally changed how I think about this. Mind blown.", likes:87,  timeAgo:'3 days ago' },
  { id:4, user:'CuriousCat99',  avatar:'https://i.pravatar.cc/32?img=14', text:"Could you do a follow-up covering the advanced topics? Please 🙏",       likes:54,  timeAgo:'4 days ago' },
]

export const moods = [
  { id:'chill',     emoji:'😌', label:'Chill',     desc:'Relax & unwind',        color:'#38bdf8',
    reasons:{ chill:'Perfect for unwinding — calm pacing, easy to follow.', focused:'Light enough to have on in the background.', curious:'Gently interesting without being intense.', energized:'A nice contrast to bring your energy down.', hype:'Might be a bit too intense right now.' } },
  { id:'focused',   emoji:'🧠', label:'Focused',   desc:'Deep work & learning',   color:'#a3e635',
    reasons:{ focused:'Dense and information-rich — great for deep focus.', chill:'Works as ambient background while you work.', curious:'Stimulating enough to keep your brain engaged.', energized:'Might pull your attention away.', hype:'Too distracting for focus mode.' } },
  { id:'curious',   emoji:'🔍', label:'Curious',   desc:'Explore & discover',     color:'#fb923c',
    reasons:{ curious:'Exactly the kind of rabbit-hole content for curious minds.', focused:'Structured and thorough — satisfies intellectual curiosity.', chill:'A gentle way to discover something new.', energized:'Dynamic and engaging — keeps you hooked.', hype:'High energy but not much depth.' } },
  { id:'energized', emoji:'⚡', label:'Energized', desc:'Pumped & motivated',     color:'#facc15',
    reasons:{ energized:'High energy and fast-paced — matches your vibe.', hype:'Pure hype fuel — great for staying pumped.', curious:'Enough substance to stay engaged while active.', chill:'Might slow your energy down.', focused:'Too slow-paced for your current energy.' } },
  { id:'hype',      emoji:'🔥', label:'Hype',      desc:'Fun & entertainment',    color:'#f472b6',
    reasons:{ hype:'Pure entertainment — exactly what you need right now.', energized:'Fast-paced and fun, keeps the hype going.', curious:'Interesting enough to keep you hooked.', chill:'Too laid-back for hype mode.', focused:'Skip — not the right vibe.' } },
]

export function getAiMatches(videos, moodId) {
  if (!moodId) return {}
  const mood = moods.find(m => m.id === moodId)
  if (!mood) return {}
  return videos.reduce((acc, v) => {
    const primary = v.tags[0], secondary = v.tags[1]
    let score = primary === moodId ? Math.floor(Math.random() * 8) + 92
              : secondary === moodId ? Math.floor(Math.random() * 10) + 76
              : Math.floor(Math.random() * 18) + 48
    acc[v.id] = { score, reason: mood.reasons[primary] || mood.reasons[secondary] || 'Worth checking out.' }
    return acc
  }, {})
}
