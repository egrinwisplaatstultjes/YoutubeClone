import { supabase } from './supabase'
import { mapVideo } from './utils'

// ── Session ID ────────────────────────────────────────────────────────────────
export function getSessionId() {
  let id = localStorage.getItem('wavr_session')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('wavr_session', id)
  }
  return id
}

// ── Videos ────────────────────────────────────────────────────────────────────

let _videosCache = null
let _videosCacheAt = 0
const CACHE_TTL = 60_000 // 60 seconds

export async function fetchVideos() {
  if (_videosCache && Date.now() - _videosCacheAt < CACHE_TTL) {
    return _videosCache
  }
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  _videosCache = (data ?? []).map(mapVideo)
  _videosCacheAt = Date.now()
  return _videosCache
}

export function getCachedVideos() {
  if (_videosCache && Date.now() - _videosCacheAt < CACHE_TTL) return _videosCache
  return null
}

function invalidateVideosCache() {
  _videosCache = null
  _videosCacheAt = 0
}

export async function incrementViews(id) {
  const key = 'wavr_viewed'
  const cooldown = 24 * 60 * 60 * 1000 // 24 hours
  const viewed = JSON.parse(localStorage.getItem(key) || '{}')
  const last = viewed[id]
  if (last && Date.now() - last < cooldown) return false
  viewed[id] = Date.now()
  localStorage.setItem(key, JSON.stringify(viewed))
  await supabase.rpc('increment_views', { vid: id })
  return true
}

export async function fetchMyVideos() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', user.id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapVideo)
}

export async function fetchArchivedVideos() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', user.id)
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapVideo)
}

export async function fetchWatchHistory() {
  const viewed = JSON.parse(localStorage.getItem('wavr_viewed') || '{}')
  // Sort by most recently watched
  const ids = Object.entries(viewed)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
  if (ids.length === 0) return []
  if (_videosCache) {
    // Preserve watch-recency order
    const map = Object.fromEntries(_videosCache.map(v => [v.id, v]))
    return ids.map(id => map[id]).filter(Boolean)
  }
  const { data, error } = await supabase
    .from('videos').select('*').in('id', ids)
  if (error) throw error
  const map = Object.fromEntries((data ?? []).map(r => [r.id, mapVideo(r)]))
  return ids.map(id => map[id]).filter(Boolean)
}

export async function fetchVideosByChannelId(channelId) {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('channel_id', channelId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapVideo)
}

export async function fetchVideo(id) {
  if (_videosCache) {
    const hit = _videosCache.find(v => v.id === id)
    if (hit) return hit
  }
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return mapVideo(data)
}

export async function createVideo({ title, description, category, tags, thumbnail, videoUrl, duration }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in to upload a video.')

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Your Channel'
  const avatar      = user.user_metadata?.avatar_url || 'https://i.pravatar.cc/40?img=33'

  const id = crypto.randomUUID()
  const { data, error } = await supabase
    .from('videos')
    .insert({
      id,
      title,
      description,
      category,
      tags,
      thumbnail,
      video_url:   videoUrl,
      duration,
      channel:     displayName,
      channel_id:  user.id,
      avatar,
      views:       0,
      subscribers: '0',
      verified:    false,
      user_id:     user.id,
    })
    .select()
    .single()
  if (error) throw error
  return mapVideo(data)
}

// ── Storage ───────────────────────────────────────────────────────────────────

/**
 * Uploads a file to the `media` Supabase Storage bucket.
 * @param {string} path  e.g. 'thumbnails/abc123.jpg'
 * @param {File}   file
 * @param {(pct: number) => void} [onProgress]
 * @returns {string} Public URL
 */
export async function uploadFile(path, file, onProgress) {
  const { error } = await supabase.storage
    .from('media')
    .upload(path, file, {
      upsert: true,
      onUploadProgress: (e) => {
        if (onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
      },
    })
  if (error) throw error
  const { data } = supabase.storage.from('media').getPublicUrl(path)
  return data.publicUrl
}

// ── Subscriptions ─────────────────────────────────────────────────────────

export async function fetchSubscriptions() {
  const sessionId = getSessionId()
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function isSubscribed(channelId) {
  const sessionId = getSessionId()
  const { data } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('session_id', sessionId)
    .eq('channel_id', channelId)
    .maybeSingle()
  return !!data
}

export async function subscribe(channelId, channelName, channelAvatar) {
  const sessionId = getSessionId()
  await supabase.from('subscriptions').upsert(
    { session_id: sessionId, channel_id: channelId, channel_name: channelName, channel_avatar: channelAvatar },
    { onConflict: 'session_id,channel_id' }
  )
}

export async function unsubscribe(channelId) {
  const sessionId = getSessionId()
  await supabase.from('subscriptions')
    .delete()
    .eq('session_id', sessionId)
    .eq('channel_id', channelId)
}

// ── Likes ─────────────────────────────────────────────────────────────────────

export async function fetchLikes(videoId) {
  const sessionId = getSessionId()
  const [{ count }, { data: row }] = await Promise.all([
    supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('video_id', videoId),
    supabase
      .from('likes')
      .select('video_id')
      .eq('video_id', videoId)
      .eq('session_id', sessionId)
      .maybeSingle(),
  ])
  return { count: count ?? 0, liked: !!row }
}

export async function toggleLike(videoId, currentlyLiked) {
  const sessionId = getSessionId()
  if (currentlyLiked) {
    await supabase.from('likes').delete()
      .eq('video_id', videoId).eq('session_id', sessionId)
    return false
  } else {
    await supabase.from('likes').insert({ video_id: videoId, session_id: sessionId })
    return true
  }
}

// ── Archive / restore / delete ────────────────────────────────────────────────

export async function archiveVideo(id) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in.')
  const { error } = await supabase
    .from('videos')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw error
  invalidateVideosCache()
}

export async function restoreVideo(id) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in.')
  const { error } = await supabase
    .from('videos')
    .update({ archived_at: null })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw error
  invalidateVideosCache()
}

export async function deleteVideo(id) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in.')
  const { error } = await supabase
    .from('videos')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw error
  invalidateVideosCache()
}

export async function updateVideo(id, { title, description, category, tags }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in.')
  const { data, error } = await supabase
    .from('videos')
    .update({ title, description, category, tags })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) throw error
  invalidateVideosCache()
  return mapVideo(data)
}

// ── Reports ───────────────────────────────────────────────────────────────────

export async function fetchReported(videoId) {
  const sessionId = getSessionId()
  const { data } = await supabase
    .from('reports')
    .select('id')
    .eq('video_id', videoId)
    .eq('session_id', sessionId)
    .maybeSingle()
  return !!data
}

export async function reportVideo(videoId) {
  const sessionId = getSessionId()
  await supabase.from('reports').upsert(
    { video_id: videoId, session_id: sessionId },
    { onConflict: 'video_id,session_id' }
  )
}

// ── Dislikes ──────────────────────────────────────────────────────────────────

export async function fetchDislike(videoId) {
  const sessionId = getSessionId()
  const { data: row } = await supabase
    .from('dislikes')
    .select('video_id')
    .eq('video_id', videoId)
    .eq('session_id', sessionId)
    .maybeSingle()
  return !!row
}

export async function toggleDislike(videoId, currentlyDisliked) {
  const sessionId = getSessionId()
  if (currentlyDisliked) {
    await supabase.from('dislikes').delete()
      .eq('video_id', videoId).eq('session_id', sessionId)
    return false
  } else {
    await supabase.from('dislikes').insert({ video_id: videoId, session_id: sessionId })
    return true
  }
}

// ── Comments ──────────────────────────────────────────────────────────────────

function enrichComment(c, sessionId) {
  const votes     = c.comment_votes ?? []
  const upCount   = votes.filter(v => v.vote === 'up').length
  const downCount = votes.filter(v => v.vote === 'down').length
  const userVote  = votes.find(v => v.session_id === sessionId)?.vote ?? null
  const { comment_votes: _cv, ...rest } = c
  return { ...rest, upCount, downCount, userVote }
}

export async function fetchComments(videoId) {
  const sessionId = getSessionId()
  const { data, error } = await supabase
    .from('comments')
    .select('*, comment_votes(vote, session_id)')
    .eq('video_id', videoId)
    .is('parent_id', null)
    .order('created_at', { ascending: false })
  if (error) throw error

  const enriched = (data ?? []).map(c => enrichComment(c, sessionId))
  if (enriched.length === 0) return enriched

  // Fetch reply counts for all top-level comments
  const ids = enriched.map(c => c.id)
  const { data: rCountData } = await supabase
    .from('comments').select('parent_id').in('parent_id', ids)
  const countMap = {}
  ;(rCountData ?? []).forEach(r => {
    if (r.parent_id) countMap[r.parent_id] = (countMap[r.parent_id] || 0) + 1
  })
  return enriched.map(c => ({ ...c, replyCount: countMap[c.id] ?? 0 }))
}

export async function fetchReplies(topLevelId) {
  const sessionId = getSessionId()
  const all = []
  let queue = [topLevelId]
  while (queue.length > 0) {
    const { data, error } = await supabase
      .from('comments')
      .select('*, comment_votes(vote, session_id)')
      .in('parent_id', queue)
      .order('created_at', { ascending: true })
    if (error) throw error
    const enriched = (data ?? []).map(c => enrichComment(c, sessionId))
    all.push(...enriched)
    queue = enriched.map(r => r.id)
  }
  return all
}

export async function voteComment(commentId, vote, currentVote) {
  const sessionId = getSessionId()
  if (currentVote === vote) {
    await supabase.from('comment_votes').delete()
      .eq('comment_id', commentId).eq('session_id', sessionId)
    return null
  }
  await supabase.from('comment_votes').upsert(
    { comment_id: commentId, session_id: sessionId, vote },
    { onConflict: 'comment_id,session_id' }
  )
  return vote
}

export async function postComment(videoId, body) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in to comment.')

  const author = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous'
  const avatar = user.user_metadata?.avatar_url || 'https://i.pravatar.cc/40?img=33'

  const { data, error } = await supabase
    .from('comments')
    .insert({ video_id: videoId, author, avatar, body, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return { ...data, upCount: 0, downCount: 0, userVote: null, replyCount: 0 }
}

export async function postReply(videoId, parentId, body) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in to reply.')

  const author = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous'
  const avatar = user.user_metadata?.avatar_url || 'https://i.pravatar.cc/40?img=33'

  const { data, error } = await supabase
    .from('comments')
    .insert({ video_id: videoId, parent_id: parentId, author, avatar, body, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return { ...data, upCount: 0, downCount: 0, userVote: null }
}
