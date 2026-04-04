export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

export function formatViews(n) {
  if (n == null) return '0'
  const num = Number(n)
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (num >= 1_000)     return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return `${num}`
}

/**
 * Returns the best avatar URL for a user.
 * Google users get their OAuth photo; email users get a generated DiceBear avatar.
 */
export function getAvatarUrl(user) {
  if (!user) return null
  if (user.user_metadata?.avatar_url) return user.user_metadata.avatar_url
  return `https://api.dicebear.com/9.x/lorelei/svg?seed=${user.id}`
}

/** Maps a raw Supabase videos row → the shape all components expect. */
export function mapVideo(row) {
  return {
    id:          row.id,
    title:       row.title,
    channel:     row.channel,
    channelId:   row.channel_id,
    avatar:      row.avatar,
    thumbnail:   row.thumbnail,
    videoUrl:    row.video_url,
    views:       row.views ?? 0,
    viewsLabel:  formatViews(row.views),
    timeAgo:     timeAgo(row.created_at),
    duration:    row.duration,
    category:    row.category,
    tags:        row.tags || [],
    subscribers: row.subscribers,
    verified:    row.verified,
    description: row.description,
    isOwn:       row.is_own ?? false,
    userId:      row.user_id ?? null,
    isLive:      row.is_live  ?? false,
    isShort:     row.is_short ?? false,
  }
}
