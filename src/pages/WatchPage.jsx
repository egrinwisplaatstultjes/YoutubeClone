import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ThumbsUp, ThumbsDown, Share2, Bookmark, MoreHorizontal,
  BadgeCheck, Send, Loader2, ChevronDown, Flag, Trash2, Radio, Users,
  Play, Pause, Volume1, Volume2, VolumeX, Settings, Maximize, Minimize,
} from 'lucide-react'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import DOMPurify from 'dompurify'
import {
  fetchVideo, fetchVideos, fetchLikes, toggleLike, fetchDislike, toggleDislike,
  fetchComments, fetchReplies, postComment, postReply, voteComment,
  incrementViews, isSubscribed, subscribe, unsubscribe, reportVideo, fetchReported, deleteVideo,
  fetchLiveChatMessages, fetchSubscriberCount,
} from '../lib/db'
import { connectToStream } from '../lib/liveStream'
import { timeAgo, formatViews, getAvatarUrl } from '../lib/utils'
import { usePlayer } from '../context/PlayerContext'
import { useAuth } from '../context/AuthContext'
import VideoCard from '../components/VideoCard'
import LivePlayer from '../components/LivePlayer'
import styles from './WatchPage.module.css'

function applyVoteChange(item, vote, currentVote, newVote) {
  let { upCount, downCount } = item
  if (newVote === null) {
    if (currentVote === 'up')   upCount--
    if (currentVote === 'down') downCount--
  } else if (!currentVote) {
    if (vote === 'up')   upCount++
    if (vote === 'down') downCount++
  } else {
    if (vote === 'up')   { upCount++; downCount-- }
    if (vote === 'down') { downCount++; upCount-- }
  }
  return { ...item, upCount, downCount, userVote: newVote }
}

export default function WatchPage() {
  const { id } = useParams()
  const { user, openAuthModal } = useAuth()
  const navigate = useNavigate()
  const [video,       setVideo]       = useState(null)
  const [related,     setRelated]     = useState([])
  const [pageLoading, setPageLoading] = useState(true)

  const player       = usePlayer()
  const containerRef = useRef(null)
  const playerOuterRef = useRef(null)

  // ── Live state ────────────────────────────────────────────────────────────
  const [isLive,         setIsLive]         = useState(false)
  const [liveStream,     setLiveStream]     = useState(null)
  const [liveMessages,   setLiveMessages]   = useState([])
  const [liveChatInput,  setLiveChatInput]  = useState('')
  const [liveChatLoading,setLiveChatLoading]= useState(false)
  const [liveViewerCount,setLiveViewerCount]= useState(0)
  const [streamEnded,    setStreamEnded]    = useState(false)
  const liveConnectionRef = useRef(null)

  // ── VOD custom player controls state ─────────────────────────────────────
  const [vodPaused,      setVodPaused]      = useState(false)
  const [vodMuted,       setVodMuted]       = useState(false)
  const [vodVolume,      setVodVolume]      = useState(1)
  const [vodShowVol,     setVodShowVol]     = useState(false)
  const [vodDuration,    setVodDuration]    = useState(0)
  const [vodShowCtrl,    setVodShowCtrl]    = useState(false)
  const [vodSettingsOpen,setVodSettingsOpen]= useState(false)
  const [vodSpeed,       setVodSpeed]       = useState(1)
  const [vodFullscreen,  setVodFullscreen]  = useState(false)
  const [vodPreview,     setVodPreview]     = useState(null) // { x, time, frame }
  const vodHideTimer       = useRef(null)
  const vodBarRef          = useRef(null)
  const vodTimeLabelRef    = useRef(null)
  const vodPreviewTimer    = useRef(null)
  const vodPreviewCloneRef = useRef(null)  // persistent clone — created once, reused
  const liveChatEndRef      = useRef(null)
  const liveChatMessagesRef = useRef(null)

  useEffect(() => {
    return () => {
      player.detach()
      // Destroy preview clone
      const c = vodPreviewCloneRef.current
      if (c) { c.onloadedmetadata = null; c.onseeked = null; c.onerror = null; c.removeAttribute('src'); c.load() }
    }
  }, [])

  // Reset all live state + stop everything whenever navigating to a different video
  useEffect(() => {
    // Stop the regular video player
    player.detach()
    // Kill any existing live connection
    if (liveConnectionRef.current) {
      liveConnectionRef.current.cleanup()
    }
    setIsLive(false)
    setLiveStream(null)
    setStreamEnded(false)
    setLiveMessages([])
    setLiveViewerCount(0)
    setLiveChatInput('')
    setLiveChatLoading(false)
    liveConnectionRef.current = null
  }, [id])

  useEffect(() => {
    setPageLoading(true)
    const isOwn = !!(user && id) // optimistic — refined after video loads
    Promise.all([
      fetchVideo(id),
      fetchVideos(),
      fetchLikes(id),
      fetchDislike(id),
      fetchReported(id),
      user ? isSubscribed(id) : Promise.resolve(false), // channelId filled below
      fetchSubscriberCount(id), // real sub count — keyed on video id first, corrected below
    ]).then(async ([v, all, likesData, disliked, alreadyReported, _subbed, _subCount]) => {
      const own = !!(user && v.channelId === user.id)
      // Re-fetch sub data with the real channelId now that we have the video
      const [{ count, liked }, subbed, subCount] = await Promise.all([
        Promise.resolve(likesData),
        own ? Promise.resolve(false) : isSubscribed(v.channelId),
        fetchSubscriberCount(v.channelId),
      ])
      setVideo({ ...v, subscribers: subCount.toLocaleString() })
      setIsLive(v.isLive)
      setRelated(all.filter(x => x.id !== id).slice(0, 6))
      setLikeCount(count)
      setLiked(liked)
      setDisliked(disliked)
      setReported(alreadyReported)
      setSubscribed(subbed)
      if (!v.isLive) {
        player.setVideo({ ...v, subscribers: subCount.toLocaleString() })
        player.hideMini()
      }
      setPageLoading(false)
      if (!v.isLive) {
        incrementViews(id).then(counted => {
          if (!counted) return
          setVideo(prev => {
            if (!prev) return prev
            const newViews = prev.views + 1
            return { ...prev, views: newViews, viewsLabel: formatViews(newViews) }
          })
        })
      }
    })
  }, [id, user?.id])

  // Re-fetch user-specific data when user logs in/out (not a full page reload)
  useEffect(() => {
    if (!video || pageLoading) return
    const own = !!(user && video.channelId === user.id)
    Promise.all([
      fetchLikes(video.id),
      fetchDislike(video.id),
      own ? Promise.resolve(false) : isSubscribed(video.channelId),
    ]).then(([{ count, liked }, disliked, subbed]) => {
      setLikeCount(count)
      setLiked(liked)
      setDisliked(disliked)
      setSubscribed(subbed)
    })
  }, [user?.id])

  useEffect(() => {
    if (!video || video.isLive || !containerRef.current) return
    const el = player.getEl()
    el.controls = false
    player.mountIn(containerRef.current, { controls: false })
    el.play().catch(() => {})
    // Sync custom controls state — update DOM directly, no React re-render
    function onTimeUpdate() {
      player.setCurrentTime(el.currentTime)
      const bar   = vodBarRef.current
      const label = vodTimeLabelRef.current
      const dur   = el.duration || 0
      if (bar) {
        bar.value = el.currentTime
        bar.style.setProperty('--pct', dur ? `${(el.currentTime / dur) * 100}%` : '0%')
      }
      if (label) label.textContent = `${formatTime(el.currentTime)} / ${formatTime(dur)}`
    }
    function onDurationChange() {
      const dur = el.duration || 0
      setVodDuration(dur)
      if (vodBarRef.current) vodBarRef.current.max = dur
      if (vodTimeLabelRef.current) vodTimeLabelRef.current.textContent = `0:00 / ${formatTime(dur)}`
    }
    function onPlayPause()      { setVodPaused(el.paused) }
    el.addEventListener('timeupdate',     onTimeUpdate)
    el.addEventListener('durationchange', onDurationChange)
    el.addEventListener('play',           onPlayPause)
    el.addEventListener('pause',          onPlayPause)
    // Fullscreen change
    function onFsChange() { setVodFullscreen(!!document.fullscreenElement) }
    document.addEventListener('fullscreenchange', onFsChange)
    // Initial state
    setVodPaused(el.paused)
    setVodVolume(el.volume)
    setVodMuted(el.muted)
    if (el.duration) setVodDuration(el.duration)
    return () => {
      el.removeEventListener('timeupdate',     onTimeUpdate)
      el.removeEventListener('durationchange', onDurationChange)
      el.removeEventListener('play',           onPlayPause)
      el.removeEventListener('pause',          onPlayPause)
      document.removeEventListener('fullscreenchange', onFsChange)
    }
  }, [video?.id, isLive])

  // ── Live stream connect ───────────────────────────────────────────────────
  useEffect(() => {
    if (!video?.isLive) return
    // Show loading immediately so there's no flash of empty state
    setLiveChatLoading(true)
    // Use a session-unique ID so returning viewers always get a fresh connection
    const viewerId = (user?.id ?? '') + '-' + Math.random().toString(36).slice(2)
    let conn

    connectToStream(id, viewerId, {
      onStream: (stream) => {
        setLiveStream(stream)
      },
      onChatMessage: (msg) => setLiveMessages(prev => [...prev, msg]),
      onViewerCount: setLiveViewerCount,
      onStreamEnd: () => {
        setStreamEnded(true)
        // Revalidate so the video shows as ended in listings
        fetchVideo(id).catch(() => {})
      },
    }).then(async c => {
      conn = c
      liveConnectionRef.current = c
      // Load chat history from DB so late-joining viewers see previous messages
      try {
        const history = await fetchLiveChatMessages(id)
        if (history.length > 0) setLiveMessages(history)
      } catch {}
      setLiveChatLoading(false)
    })

    return () => { conn?.cleanup() }
  }, [video?.id, video?.isLive])
  // ── Live chat scroll ──────────────────────────────────────────────────────
  useEffect(() => {
    if (liveChatMessagesRef.current) {
      liveChatMessagesRef.current.scrollTop = liveChatMessagesRef.current.scrollHeight
    }
  }, [liveMessages])

  function handleLiveChatSubmit(e) {
    e.preventDefault()
    if (!liveChatInput.trim() || !liveConnectionRef.current) return
    const msg = {
      author: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Viewer',
      body: liveChatInput.trim(),
      ts: Date.now(),
    }
    liveConnectionRef.current.sendChat(msg)
    setLiveMessages(prev => [...prev, msg])
    setLiveChatInput('')
  }

  // ── UI state ──────────────────────────────────────────────────────────────
  const [saved,         setSaved]         = useState(false)
  const [showMore,      setShowMore]      = useState(false)
  const [reported,      setReported]      = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting,      setDeleting]      = useState(false)
  const moreRef = useRef(null)
  const [subscribed, setSubscribed] = useState(false)
  const [subLoading, setSubLoading] = useState(false)
  const [expanded,   setExpanded]   = useState(false)

  const isOwnChannel = !!(user && video && user.id === video.channelId)

  useEffect(() => {
    if (!showMore) return
    function onOutside(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) setShowMore(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [showMore])


  async function handleSubscribe(e) {
    e.preventDefault()
    if (subLoading || !video) return
    setSubLoading(true)
    if (subscribed) {
      await unsubscribe(video.channelId)
      setSubscribed(false)
      setVideo(v => v ? { ...v, subscribers: Math.max(0, parseInt(v.subscribers) - 1).toLocaleString() } : v)
    } else {
      await subscribe(video.channelId, video.channel, video.avatar)
      setSubscribed(true)
      setVideo(v => v ? { ...v, subscribers: (parseInt(v.subscribers || '0') + 1).toLocaleString() } : v)
    }
    setSubLoading(false)
    window.dispatchEvent(new CustomEvent('velora:subs-changed'))
  }

  // ── Video likes ───────────────────────────────────────────────────────────
  const [liked,          setLiked]          = useState(false)
  const [likeCount,      setLikeCount]      = useState(0)
  const [likeLoading,    setLikeLoading]    = useState(false)
  const [disliked,       setDisliked]       = useState(false)
  const [dislikeLoading, setDislikeLoading] = useState(false)
  const [copied,         setCopied]         = useState(false)


  async function handleLike() {
    if (!user) { openAuthModal(); return }
    if (likeLoading) return
    setLikeLoading(true)
    const nowLiked = await toggleLike(video.id, liked)
    setLiked(nowLiked)
    setLikeCount(c => nowLiked ? c + 1 : c - 1)
    if (nowLiked && disliked) { await toggleDislike(video.id, true); setDisliked(false) }
    setLikeLoading(false)
  }

  async function handleDislike() {
    if (!user) { openAuthModal(); return }
    if (dislikeLoading) return
    setDislikeLoading(true)
    const nowDisliked = await toggleDislike(video.id, disliked)
    setDisliked(nowDisliked)
    if (nowDisliked && liked) { await toggleLike(video.id, true); setLiked(false); setLikeCount(c => c - 1) }
    setDislikeLoading(false)
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteVideo(video.id)
      navigate('/profile')
    } catch {
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }

  function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }).catch(() => fallbackCopy(text))
    } else {
      fallbackCopy(text)
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px'
    document.body.appendChild(ta)
    ta.focus(); ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleShare() {
    copyToClipboard(window.location.href)
  }

  async function handleReport() {
    if (reportLoading || reported) return
    setReportLoading(true)
    await reportVideo(video.id)
    setReported(true)
    setReportLoading(false)
    setShowMore(false)
  }


  // ── Comments ──────────────────────────────────────────────────────────────
  const [comments,        setComments]        = useState([])
  const [commentText,     setCommentText]      = useState('')
  const [submitting,      setSubmitting]       = useState(false)
  const [commentsLoading, setCommentsLoading]  = useState(true)

  const [visibleCount, setVisibleCount] = useState(10)
  const sentinelRef = useRef(null)

  // replyingTo: { threadId, parentId } | null
  // threadId = top-level comment id (key for repliesMap)
  // parentId = actual parent (comment or reply) stored in DB
  const [replyingTo,      setReplyingTo]      = useState(null)
  const [replyText,       setReplyText]        = useState('')
  const [submittingReply, setSubmittingReply]  = useState(false)
  const [repliesMap,      setRepliesMap]       = useState({}) // threadId → flat array of ALL descendants
  const [loadingReplies,  setLoadingReplies]   = useState(new Set())

  const sortedComments = useMemo(
    () => [...comments].sort((a, b) => b.upCount - a.upCount),
    [comments]
  )
  const hasMore = visibleCount < sortedComments.length

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount(v => v + 15)
    }, { rootMargin: '400px' })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [hasMore])

  const loadComments = useCallback(async () => {
    if (!video) return
    setCommentsLoading(true)
    const data = await fetchComments(video.id)
    setComments(data)
    setCommentsLoading(false)
  }, [video])

  useEffect(() => { loadComments() }, [loadComments])

  async function handleSubmitComment(e) {
    e.preventDefault()
    if (!user) { openAuthModal(); return }
    if (!commentText.trim() || submitting) return
    setSubmitting(true)
    try {
      const row = await postComment(video.id, commentText.trim())
      setComments(prev => [row, ...prev])
      setCommentText('')
    } finally { setSubmitting(false) }
  }

  async function handleCommentVote(commentId, vote, currentVote) {
    if (!user) { openAuthModal(); return }
    const newVote = await voteComment(commentId, vote, currentVote)
    setComments(prev => prev.map(c =>
      c.id === commentId ? applyVoteChange(c, vote, currentVote, newVote) : c
    ))
  }

  async function handleReplyVote(threadId, replyId, vote, currentVote) {
    if (!user) { openAuthModal(); return }
    const newVote = await voteComment(replyId, vote, currentVote)
    setRepliesMap(prev => ({
      ...prev,
      [threadId]: (prev[threadId] ?? []).map(r =>
        r.id === replyId ? applyVoteChange(r, vote, currentVote, newVote) : r
      ),
    }))
  }

  async function handleLoadReplies(commentId) {
    if (repliesMap[commentId]) return
    setLoadingReplies(prev => new Set([...prev, commentId]))
    try {
      const data = await fetchReplies(commentId)
      setRepliesMap(prev => ({ ...prev, [commentId]: data }))
    } finally {
      setLoadingReplies(prev => { const s = new Set(prev); s.delete(commentId); return s })
    }
  }

  async function handleSubmitReply(e, threadId, parentId) {
    e.preventDefault()
    if (!user) { openAuthModal(); return }
    if (!replyText.trim() || submittingReply) return
    setSubmittingReply(true)
    try {
      const row = await postReply(video.id, parentId, replyText.trim())
      setRepliesMap(prev => ({ ...prev, [threadId]: [...(prev[threadId] ?? []), row] }))
      // Increment replyCount on the top-level comment only for direct replies
      if (parentId === threadId) {
        setComments(prev => prev.map(c =>
          c.id === threadId ? { ...c, replyCount: (c.replyCount || 0) + 1 } : c
        ))
      }
      setReplyText('')
      setReplyingTo(null)
    } finally { setSubmittingReply(false) }
  }

  function openReply(threadId, parentId, prefix = '') {
    if (!user) { openAuthModal(); return }
    const alreadyOpen = replyingTo?.threadId === threadId && replyingTo?.parentId === parentId
    if (alreadyOpen && !prefix) {
      setReplyingTo(null)
      setReplyText('')
    } else {
      setReplyingTo({ threadId, parentId })
      setReplyText(prefix)
    }
  }

  const isReplying = (threadId, parentId) =>
    replyingTo?.threadId === threadId && replyingTo?.parentId === parentId

  if (pageLoading || !video) {
    return (
      <div className={styles.page}>
        <div className={styles.main}>
          <div className={`${styles.skelVideoWrap} ${styles.skel}`} />
          <div className={styles.skelMeta}>
            <div className={`${styles.skel} ${styles.skelLine} ${styles.skelTitle}`} />
            <div className={styles.skelRow}>
              <div className={`${styles.skel} ${styles.skelAvatar}`} />
              <div className={styles.skelLines}>
                <div className={`${styles.skel} ${styles.skelLine} ${styles.skelName}`} />
                <div className={`${styles.skel} ${styles.skelLine} ${styles.skelSub}`} />
              </div>
              <div className={styles.skelChips}>
                {[80, 60, 80, 70].map((w, i) => (
                  <div key={i} className={`${styles.skel} ${styles.skelChip}`} style={{ width: w }} />
                ))}
              </div>
            </div>
            <div className={`${styles.skel} ${styles.skelLine} ${styles.skelDesc}`} />
            <div className={`${styles.skel} ${styles.skelLine} ${styles.skelDesc} ${styles.skelDescShort}`} />
          </div>
        </div>
        <aside className={styles.sidebar}>
          {[1,2,3,4].map(i => (
            <div key={i} className={styles.skelCard}>
              <div className={`${styles.skel} ${styles.skelCardThumb}`} />
              <div className={styles.skelCardInfo}>
                <div className={`${styles.skel} ${styles.skelLine} ${styles.skelCardTitle}`} />
                <div className={`${styles.skel} ${styles.skelLine} ${styles.skelCardMeta}`} />
              </div>
            </div>
          ))}
        </aside>
      </div>
    )
  }

  const composeAvatar = getAvatarUrl(user)

  // Recursive reply tree renderer — depth=0 uses repliesListTop (aligns with parent avatar line)
  function renderReplies(allReplies, parentId, threadId, depth = 0) {
    const direct = allReplies.filter(r => r.parent_id === parentId)
    if (direct.length === 0) return null
    const listClass = depth === 0 ? styles.repliesListTop : styles.repliesList
    return (
      <div className={listClass}>
        {direct.map(r => (
          <div key={r.id}>
            <div className={styles.reply}>
              <img
                src={r.avatar || `https://api.dicebear.com/9.x/lorelei/svg?seed=${r.author}`}
                alt={r.author}
                className={styles.rAvatar}
              />
              <div className={styles.cBody}>
                <div className={styles.cTop}>
                  <span className={styles.cUser}>{r.author}</span>
                  <span className={styles.cTime}>{timeAgo(r.created_at)}</span>
                </div>
                <p className={styles.cText}>{r.body}</p>
                <div className={styles.cActions}>
                  <button
                    className={`${styles.cAction} ${r.userVote === 'up' ? styles.cVoted : ''}`}
                    onClick={() => handleReplyVote(threadId, r.id, 'up', r.userVote)}
                  >
                    <ThumbsUp size={15} />
                    {r.upCount > 0 && <span>{r.upCount}</span>}
                  </button>
                  <button
                    className={`${styles.cAction} ${r.userVote === 'down' ? styles.cDownvoted : ''}`}
                    onClick={() => handleReplyVote(threadId, r.id, 'down', r.userVote)}
                  >
                    <ThumbsDown size={15} />
                    {r.downCount > 0 && <span>{r.downCount}</span>}
                  </button>
                  <button
                    className={styles.cReply}
                    onClick={() => openReply(threadId, r.id, '@' + r.author + ' ')}
                  >
                    Reply
                  </button>
                </div>

                {/* Reply form for this reply */}
                {isReplying(threadId, r.id) && (
                  <form
                    className={styles.replyForm}
                    onSubmit={e => handleSubmitReply(e, threadId, r.id)}
                  >
                    <img src={composeAvatar} alt="You" className={styles.replyAvatar} referrerPolicy="no-referrer" />
                    <div className={styles.composeBox}>
                      <input
                        className={styles.composeInput}
                        placeholder={`Reply to ${r.author}…`}
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        autoFocus
                      />
                      {replyText.trim() && (
                        <button type="submit" className={styles.sendBtn} disabled={submittingReply}>
                          {submittingReply
                            ? <Loader2 size={13} className={styles.spin} />
                            : <Send size={13} />}
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Recurse into children — each level adds another indented repliesList */}
            {renderReplies(allReplies, r.id, threadId, depth + 1)}
          </div>
        ))}
      </div>
    )
  }

  // ── VOD player helpers ──────────────────────────────────────────────────
  function vodRevealControls() {
    setVodShowCtrl(true)
    clearTimeout(vodHideTimer.current)
    vodHideTimer.current = setTimeout(() => setVodShowCtrl(false), 3000)
  }
  function formatTime(s) {
    if (!s || isNaN(s)) return '0:00'
    const m   = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }
  function vodTogglePlay() {
    const el = player.getEl()
    if (!el) return
    if (el.paused) { el.play().catch(() => {}); setVodPaused(false) }
    else           { el.pause();                setVodPaused(true) }
  }
  function vodToggleMute() {
    const el = player.getEl()
    if (!el) return
    el.muted = !vodMuted
    setVodMuted(!vodMuted)
  }
  function vodChangeVolume(e) {
    const v = parseFloat(e.target.value)
    const el = player.getEl()
    if (el) { el.volume = v; el.muted = v === 0 }
    setVodVolume(v)
    setVodMuted(v === 0)
  }
  function vodSeek(e) {
    const el = player.getEl()
    if (!el) return
    el.currentTime = parseFloat(e.target.value)
  }
  function vodChangeSpeed(s) {
    const el = player.getEl()
    if (el) el.playbackRate = s
    setVodSpeed(s)
    setVodSettingsOpen(false)
  }
  function vodToggleFullscreen() {
    if (!document.fullscreenElement) playerOuterRef.current?.requestFullscreen()
    else document.exitFullscreen()
  }
  function VodVolumeIcon() {
    if (vodMuted || vodVolume === 0) return <VolumeX size={18} />
    if (vodVolume < 0.5)             return <Volume1 size={18} />
    return                                  <Volume2 size={18} />
  }

  // VOD scrubber hover preview
  function vodBarHover(e) {
    const bar = vodBarRef.current
    const dur = parseFloat(bar?.max) || 0
    if (!bar || !dur) return
    const rect = bar.getBoundingClientRect()
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const time = pct * dur
    setVodPreview(p => ({ ...(p || {}), x: e.clientX - rect.left, time, frame: p?.frame ?? null }))

    clearTimeout(vodPreviewTimer.current)
    vodPreviewTimer.current = setTimeout(() => {
      const el = player.getEl()
      if (!el?.src) return

      // Lazily create ONE persistent clone element
      if (!vodPreviewCloneRef.current) {
        const v = document.createElement('video')
        v.crossOrigin = 'anonymous'
        v.muted       = true
        v.preload     = 'metadata'
        vodPreviewCloneRef.current = v
      }
      const clone = vodPreviewCloneRef.current

      // Re-load only when the src changes
      if (clone.dataset.loadedSrc !== el.src) {
        clone.dataset.loadedSrc = el.src
        clone.src = el.src
      }

      function doSeek() {
        clone.onseeked = () => {
          try {
            const c = document.createElement('canvas')
            c.width = 160; c.height = 90
            c.getContext('2d').drawImage(clone, 0, 0, 160, 90)
            setVodPreview(p => p ? { ...p, frame: c.toDataURL('image/jpeg', 0.7) } : null)
          } catch { /* CORS taint — show label only */ }
        }
        clone.currentTime = time
      }

      if (clone.readyState >= 1) { // HAVE_METADATA
        doSeek()
      } else {
        clone.onloadedmetadata = () => { clone.onloadedmetadata = null; doSeek() }
      }
    }, 120)
  }
  function vodBarLeave() {
    clearTimeout(vodPreviewTimer.current)
    setVodPreview(null)
  }

  return (
    <div className={styles.page}>

      {/* ── Main column ── */}
      <div className={styles.main}>

        {/* Player */}
        {isLive ? (
          <LivePlayer
            stream={liveStream}
            viewerCount={liveViewerCount}
            streamEnded={streamEnded}
          />
        ) : (
          <div
            ref={playerOuterRef}
            className={styles.playerOuter}
            onMouseMove={vodRevealControls}
            onMouseLeave={() => { clearTimeout(vodHideTimer.current); setVodShowCtrl(false) }}
          >
            <div ref={containerRef} className={styles.playerWrap} />
            <div className={`${styles.vodControls} ${vodShowCtrl ? styles.vodControlsVisible : ''}`}>
              {/* Progress bar */}
              <div
                className={styles.vodScrubRow}
                onMouseMove={vodBarHover}
                onMouseLeave={vodBarLeave}
              >
<input
                  ref={vodBarRef}
                  type="range"
                  min={0}
                  max={vodDuration || 100}
                  step={0.1}
                  defaultValue={0}
                  onChange={vodSeek}
                  className={styles.vodBar}
                />
                {/* Hover preview tooltip */}
                {vodPreview && (
                  <div
                    className={styles.vodPreviewTooltip}
                    style={{ left: `clamp(80px, ${vodPreview.x}px, calc(100% - 80px))` }}
                  >
                    {vodPreview.frame
                      ? <img src={vodPreview.frame} className={styles.vodPreviewThumb} alt="" />
                      : <div className={styles.vodPreviewThumbBlank} />
                    }
                    <span className={styles.vodPreviewLabel}>{formatTime(vodPreview.time)}</span>
                  </div>
                )}
              </div>
              {/* Buttons */}
              <div className={styles.vodBtnRow}>
                <div className={styles.vodLeft}>
                  <button className={styles.vodBtn} onClick={vodTogglePlay} title={vodPaused ? 'Play' : 'Pause'}>
                    {vodPaused ? <Play size={18} fill="white" /> : <Pause size={18} fill="white" />}
                  </button>
                  <div
                    className={styles.vodVolGroup}
                    onMouseEnter={() => setVodShowVol(true)}
                    onMouseLeave={() => setVodShowVol(false)}
                  >
                    <button className={styles.vodBtn} onClick={vodToggleMute} title={vodMuted ? 'Unmute' : 'Mute'}>
                      <VodVolumeIcon />
                    </button>
                    <div className={`${styles.vodVolSliderWrap} ${vodShowVol ? styles.vodVolSliderVisible : ''}`}>
                      <input
                        type="range" min={0} max={1} step={0.02}
                        value={vodMuted ? 0 : vodVolume}
                        onChange={vodChangeVolume}
                        className={styles.vodVolSlider}
                      />
                    </div>
                  </div>
                  <span ref={vodTimeLabelRef} className={styles.vodTime}>0:00 / 0:00</span>
                </div>
                <div className={styles.vodRight}>
                  <div className={styles.vodSettingsWrap}>
                    <button
                      className={styles.vodBtn}
                      onClick={() => setVodSettingsOpen(s => !s)}
                      title="Settings"
                    >
                      <Settings size={17} />
                    </button>
                    {vodSettingsOpen && (
                      <div className={styles.vodSettingsMenu} onMouseLeave={() => setVodSettingsOpen(false)}>
                        <p className={styles.vodSettingsLabel}>Speed</p>
                        {[0.5, 1, 1.25, 1.5, 2].map(s => (
                          <button
                            key={s}
                            className={`${styles.vodSettingsItem} ${vodSpeed === s ? styles.vodSettingsItemActive : ''}`}
                            onClick={() => vodChangeSpeed(s)}
                          >
                            {s === 1 ? 'Normal' : `${s}×`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className={styles.vodBtn} onClick={vodToggleFullscreen} title={vodFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                    {vodFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Title + meta */}
        <div className={styles.meta}>
          <h1 className={styles.title}>{video.title}</h1>

          <div className={styles.metaRow}>
            <Link to={`/channel/${video.channelId}`} className={styles.channelBlock}>
              <img src={video.avatar} alt={video.channel} className={styles.chAvatar} />
              <div>
                <div className={styles.chName}>
                  {video.channel}
                  {video.verified && <BadgeCheck size={14} className={styles.chCheck} />}
                </div>
                <div className={styles.chSub}>{video.subscribers} subscribers</div>
              </div>
              {!isOwnChannel && (
                <button
                  className={`${styles.subBtn} ${subscribed ? styles.subbed : ''}`}
                  onClick={handleSubscribe}
                  disabled={subLoading}
                >
                  {subscribed ? 'Subscribed' : 'Subscribe'}
                </button>
              )}
            </Link>

            <div className={styles.actions}>
              <button
                className={`${styles.chip} ${liked ? styles.chipOn : ''}`}
                onClick={handleLike}
                disabled={likeLoading}
              >
                <ThumbsUp size={14} />
                {likeCount > 0 ? likeCount.toLocaleString() : 'Like'}
              </button>
              <button
                className={`${styles.chip} ${disliked ? styles.chipDown : ''}`}
                onClick={handleDislike}
                disabled={dislikeLoading}
              >
                <ThumbsDown size={14} />
              </button>
              <button className={`${styles.chip} ${copied ? styles.chipOn : ''}`} onClick={handleShare}>
                <Share2 size={14} /> {copied ? 'Copied!' : 'Share'}
              </button>
              <button
                className={`${styles.chip} ${saved ? styles.chipOn : ''}`}
                onClick={() => setSaved(s => !s)}
              >
                <Bookmark size={14} /> {saved ? 'Saved' : 'Save'}
              </button>
              <div className={styles.moreWrap} ref={moreRef}>
                <button className={`${styles.chip} ${showMore ? styles.chipOn : ''}`} onClick={() => setShowMore(m => !m)}>
                  <MoreHorizontal size={14} />
                </button>
                {showMore && (
                  <div className={styles.moreMenu}>
                    {isOwnChannel ? (
                      deleteConfirm ? (
                        <div className={styles.moreDeleteConfirm}>
                          <p className={styles.moreDeleteText}>Delete this video?</p>
                          <div className={styles.moreDeleteBtns}>
                            <button className={styles.moreDeleteCancel} onClick={() => setDeleteConfirm(false)} disabled={deleting}>Cancel</button>
                            <button className={styles.moreDeleteOk} onClick={handleDelete} disabled={deleting}>
                              {deleting ? <Loader2 size={13} className={styles.spin} /> : 'Delete'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className={`${styles.moreItem} ${styles.moreItemDanger}`}
                          onClick={() => setDeleteConfirm(true)}
                        >
                          <Trash2 size={15} /> Delete video
                        </button>
                      )
                    ) : (
                      <button
                        className={`${styles.moreItem} ${styles.moreItemDanger}`}
                        onClick={handleReport}
                        disabled={reportLoading || reported}
                      >
                        {reportLoading
                          ? <><Loader2 size={15} className={styles.spin} /> Reporting…</>
                          : <><Flag size={15} /> {reported ? 'Reported' : 'Report'}</>
                        }
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className={styles.desc}>
            <p className={styles.descStats}>{video.viewsLabel} views · {video.timeAgo}</p>
            {video.description ? (
              <>
                <div
                  className={`${styles.descText} ${expanded ? '' : styles.descClamped}`}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(video.description, { ADD_ATTR: ['target'] }) }}
                />
                <button className={styles.descToggle} onClick={() => setExpanded(e => !e)}>
                  {expanded ? 'Show less' : '...more'}
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* Comments */}
        {!isLive && <div className={styles.comments}>
          <h3 className={styles.commentsTitle}>
            {commentsLoading
              ? 'Comments'
              : `${comments.length} Comment${comments.length !== 1 ? 's' : ''}`}
          </h3>

          {/* Compose */}
          <form className={styles.commentCompose} onSubmit={handleSubmitComment}>
            <img src={composeAvatar} alt="You" className={styles.composeAvatar} referrerPolicy="no-referrer" />
            <div className={styles.composeBox}>
              <input
                className={styles.composeInput}
                placeholder={user ? 'Add a comment...' : 'Sign in to comment...'}
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onFocus={!user ? openAuthModal : undefined}
                readOnly={!user}
              />
              {commentText.trim() && (
                <button type="submit" className={styles.sendBtn} disabled={submitting}>
                  {submitting ? <Loader2 size={13} className={styles.spin} /> : <Send size={13} />}
                </button>
              )}
            </div>
          </form>

          {/* Comment list */}
          <div className={styles.commentList}>
            {commentsLoading ? (
              <div className={styles.loadingRow}>
                <Loader2 size={18} className={styles.spin} />
                <span>Loading comments…</span>
              </div>
            ) : comments.length === 0 ? (
              <p className={styles.noComments}>No comments yet. Be the first!</p>
            ) : (
              <>
                {sortedComments.slice(0, visibleCount).map(c => (
                  <div key={c.id} className={styles.comment}>
                    <div className={styles.cAvatarCol}>
                      <img
                        src={c.avatar || `https://api.dicebear.com/9.x/lorelei/svg?seed=${c.author}`}
                        alt={c.author}
                        className={styles.cAvatar}
                      />
                      {repliesMap[c.id]?.length > 0 && <div className={styles.cThreadLine} />}
                    </div>
                    <div className={styles.cBody}>
                      <div className={styles.cTop}>
                        <span className={styles.cUser}>{c.author}</span>
                        <span className={styles.cTime}>{timeAgo(c.created_at)}</span>
                      </div>
                      <p className={styles.cText}>{c.body}</p>

                      <div className={styles.cActions}>
                        <button
                          className={`${styles.cAction} ${c.userVote === 'up' ? styles.cVoted : ''}`}
                          onClick={() => handleCommentVote(c.id, 'up', c.userVote)}
                        >
                          <ThumbsUp size={15} />
                          {c.upCount > 0 && <span>{c.upCount}</span>}
                        </button>
                        <button
                          className={`${styles.cAction} ${c.userVote === 'down' ? styles.cDownvoted : ''}`}
                          onClick={() => handleCommentVote(c.id, 'down', c.userVote)}
                        >
                          <ThumbsDown size={15} />
                          {c.downCount > 0 && <span>{c.downCount}</span>}
                        </button>
                        <button className={styles.cReply} onClick={() => openReply(c.id, c.id)}>
                          Reply
                        </button>
                      </div>

                      {/* Reply form for top-level comment */}
                      {isReplying(c.id, c.id) && (
                        <form
                          className={styles.replyForm}
                          onSubmit={e => handleSubmitReply(e, c.id, c.id)}
                        >
                          <img src={composeAvatar} alt="You" className={styles.replyAvatar} referrerPolicy="no-referrer" />
                          <div className={styles.composeBox}>
                            <input
                              className={styles.composeInput}
                              placeholder={`Reply to ${c.author}…`}
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              autoFocus
                            />
                            {replyText.trim() && (
                              <button type="submit" className={styles.sendBtn} disabled={submittingReply}>
                                {submittingReply
                                  ? <Loader2 size={13} className={styles.spin} />
                                  : <Send size={13} />}
                              </button>
                            )}
                          </div>
                        </form>
                      )}

                      {/* Load replies button */}
                      {c.replyCount > 0 && !repliesMap[c.id] && (
                        <button
                          className={styles.viewReplies}
                          onClick={() => handleLoadReplies(c.id)}
                        >
                          {loadingReplies.has(c.id)
                            ? <><Loader2 size={13} className={styles.spin} /> Loading…</>
                            : <><ChevronDown size={13} /> {c.replyCount} {c.replyCount === 1 ? 'reply' : 'replies'}</>
                          }
                        </button>
                      )}

                      {/* Reply tree — recursive, each nesting level gets its own border-left */}
                      {repliesMap[c.id] && renderReplies(repliesMap[c.id], c.id, c.id)}
                    </div>
                  </div>
                ))}

                {hasMore
                  ? <div ref={sentinelRef} className={styles.sentinel} />
                  : comments.length > 10 && (
                    <p className={styles.allLoaded}>All comments loaded</p>
                  )
                }
              </>
            )}
          </div>
        </div>
        }

      </div>

      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        {isLive ? (
          <div className={styles.liveChatPanel}>
            <div className={styles.liveChatPanelHeader}>
              <div className={styles.liveChatPanelTitle}>
                <Radio size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                Live Chat
              </div>
              {liveViewerCount > 0 && <span className={styles.liveChatViewers}><Users size={11} style={{display:'inline', marginRight:4}} />{liveViewerCount} watching</span>}
            </div>
            <div ref={liveChatMessagesRef} className={styles.liveChatMessages}>
              {liveChatLoading ? (
                <div className={styles.liveChatEmpty}>
                  <Loader2 size={20} className={styles.spin} />
                  <p>Loading chat…</p>
                </div>
              ) : liveMessages.length === 0 ? (
                <div className={styles.liveChatEmpty}>
                  <p>Chat will appear here once someone sends a message…</p>
                </div>
              ) : null}
              {liveMessages.map((m, i) => (
                <div key={i} className={styles.liveChatMsg}>
                  <img
                    src={m.avatar || `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(m.author)}`}
                    alt={m.author}
                    className={styles.liveChatAvatar}
                    referrerPolicy="no-referrer"
                  />
                  <div className={styles.liveChatContent}>
                    <span className={styles.liveChatAuthor}>{m.author}</span>
                    {m.isHost && <span className={styles.liveChatHostBadge}>Host</span>}
                    <span className={styles.liveChatBody}>{m.body}</span>
                  </div>
                </div>
              ))}
              <div ref={liveChatEndRef} />
            </div>
            {user ? (
              <form className={styles.liveChatForm} onSubmit={handleLiveChatSubmit}>
                <input
                  className={styles.liveChatInput}
                  placeholder="Say something…"
                  value={liveChatInput}
                  onChange={e => setLiveChatInput(e.target.value)}
                  maxLength={200}
                />
                <button type="submit" className={styles.liveChatSendBtn} disabled={!liveChatInput.trim()}>
                  <Send size={14} />
                </button>
              </form>
            ) : (
              <p className={styles.liveChatSignIn}>Sign in to chat</p>
            )}
          </div>
        ) : (
          <>
            <p className={styles.upNext}>Up Next</p>
            <div className={styles.relatedList}>
              {related.map(v => <VideoCard key={v.id} video={v} />)}
            </div>
          </>
        )}
      </aside>

    </div>
  )
}
