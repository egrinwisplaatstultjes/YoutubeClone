import { useState, useEffect, useRef } from 'react'
import { ThumbsUp, ThumbsDown, MessageCircle, Volume2, VolumeX, X, Plus, Loader2, Play, Share2, Bookmark } from 'lucide-react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchShortById, fetchShortsPage, fetchComments, fetchReplies, postComment, postReply, fetchLikes, toggleLike as toggleLikeDB, voteComment } from '../lib/db'
import { formatViews, getAvatarUrl, timeAgo } from '../lib/utils'
import styles from './ShortsPage.module.css'

const PAGE_SIZE = 5

function CommentThread({ comment: initial, depth = 0, videoId, user, openAuthModal }) {
  const [comment,    setComment]    = useState(initial)
  const [expanded,   setExpanded]   = useState(false)
  const [replies,    setReplies]    = useState(null)
  const [loadingRep, setLoadingRep] = useState(false)
  const [replyOpen,  setReplyOpen]  = useState(false)
  const [replyText,  setReplyText]  = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function toggleReplies() {
    if (!expanded && replies === null) {
      setLoadingRep(true)
      try { setReplies(await fetchReplies(comment.id)) }
      finally { setLoadingRep(false) }
    }
    setExpanded(o => !o)
  }

  async function handleVote(vote) {
    if (!user) { openAuthModal(); return }
    const prev = comment.userVote
    // Optimistic update
    const optimisticVote = prev === vote ? null : vote
    setComment(c => ({
      ...c,
      userVote:  optimisticVote,
      upCount:   c.upCount   + (optimisticVote === 'up'   ? 1 : prev === 'up'   ? -1 : 0),
      downCount: c.downCount + (optimisticVote === 'down' ? 1 : prev === 'down' ? -1 : 0),
    }))
    try {
      await voteComment(comment.id, vote, prev)
    } catch {
      // Revert on error
      setComment(c => ({
        ...c,
        userVote:  prev,
        upCount:   c.upCount   - (optimisticVote === 'up'   ? 1 : prev === 'up'   ? -1 : 0),
        downCount: c.downCount - (optimisticVote === 'down' ? 1 : prev === 'down' ? -1 : 0),
      }))
    }
  }

  async function submitReply() {
    const body = replyText.trim()
    if (!body || submitting) return
    if (!user) { openAuthModal(); return }
    setSubmitting(true)
    try {
      const newReply = await postReply(videoId, comment.id, body)
      setReplies(prev => [...(prev ?? []), newReply])
      setReplyText('')
      setReplyOpen(false)
      setExpanded(true)
    } catch (err) { console.error(err) }
    finally { setSubmitting(false) }
  }

  const avatarSrc = comment.avatar ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(comment.author || 'User')}`

  return (
    <div className={styles.thread} style={{ '--depth': depth }}>
      <div className={styles.comment}>
        <img src={avatarSrc} alt={comment.author} className={styles.cAvatar} />
        <div className={styles.cBody}>
          <div className={styles.cTop}>
            <span className={styles.cUser}>{comment.author || 'Anonymous'}</span>
            <span className={styles.cTime}>{timeAgo(comment.created_at)}</span>
          </div>
          <p className={styles.cText}>{comment.body}</p>
          <div className={styles.cActions}>
            <button
              className={`${styles.voteBtn} ${comment.userVote === 'up' ? styles.voteBtnActive : ''}`}
              onClick={() => handleVote('up')}
            >
              <ThumbsUp size={12} fill={comment.userVote === 'up' ? 'currentColor' : 'none'} />
              {comment.upCount > 0 && <span>{comment.upCount}</span>}
            </button>
            <button
              className={`${styles.voteBtn} ${comment.userVote === 'down' ? styles.voteBtnActive : ''}`}
              onClick={() => handleVote('down')}
            >
              <ThumbsDown size={12} fill={comment.userVote === 'down' ? 'currentColor' : 'none'} />
            </button>
            <button className={styles.replyBtn} onClick={() => {
              if (!user) { openAuthModal(); return }
              setReplyOpen(o => !o)
            }}>Reply</button>
            {(comment.replyCount > 0 || replies?.length > 0) && (
              <button className={styles.viewRepliesBtn} onClick={toggleReplies}>
                {loadingRep ? 'Loading…' : expanded ? 'Hide replies'
                  : `View ${comment.replyCount || replies?.length} repl${comment.replyCount === 1 ? 'y' : 'ies'}`}
              </button>
            )}
          </div>
          {replyOpen && (
            <div className={styles.replyCompose}>
              <input
                className={styles.replyInput}
                placeholder={`Reply to ${comment.author}…`}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitReply()}
                autoFocus
              />
              <button className={styles.composeSend} onClick={submitReply} disabled={submitting || !replyText.trim()}>
                {submitting ? '…' : 'Post'}
              </button>
            </div>
          )}
        </div>
      </div>
      {expanded && replies && replies.map(r => (
        <CommentThread key={r.id} comment={r} depth={depth + 1} videoId={videoId} user={user} openAuthModal={openAuthModal} />
      ))}
    </div>
  )
}

export default function ShortsPage() {
  const { user, openAuthModal } = useAuth()
  const { id: initialId }       = useParams()
  const navigate                = useNavigate()

  const [shorts,          setShorts]         = useState([])
  const [loading,         setLoading]        = useState(true)
  const [hasMore,         setHasMore]        = useState(true)
  const [loadingMore,     setLoadingMore]    = useState(false)
  const [activeIdx,       setActiveIdx]      = useState(0)
  const [muted,           setMuted]          = useState(false)
  const [paused,          setPaused]         = useState(false)
  const [liked,           setLiked]          = useState({})
  const [likeCounts,      setLikeCounts]     = useState({})
  const [saved,           setSaved]          = useState({})
  const [shareOpenId,     setShareOpenId]    = useState(null)
  const [copied,          setCopied]         = useState(false)
  const [commentsOpen,    setCommentsOpen]   = useState(false)
  const [commentsByShort, setCommentsByShort] = useState({})
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentInput,    setCommentInput]    = useState('')
  const [submitting,      setSubmitting]      = useState(false)

  const videoRefs  = useRef([])
  const itemRefs   = useRef([])
  const feedRef    = useRef(null)
  const cursorRef  = useRef(null)  // created_at of the last loaded short

  // Close share popover on outside click
  useEffect(() => {
    if (!shareOpenId) return
    function onOutside(e) {
      if (!e.target.closest('[data-share-anchor]')) setShareOpenId(null)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [shareOpenId])

  // Append new shorts and hydrate their like states (deduplicates by ID)
  async function appendShorts(newShorts) {
    if (newShorts.length === 0) return
    const results = await Promise.all(newShorts.map(s => fetchLikes(s.id)))
    const likedMap = {}
    const countMap = {}
    newShorts.forEach((s, i) => {
      likedMap[s.id] = results[i].liked
      countMap[s.id] = results[i].count
    })
    setShorts(prev => {
      const seen = new Set(prev.map(s => s.id))
      const fresh = newShorts.filter(s => !seen.has(s.id))
      return fresh.length ? [...prev, ...fresh] : prev
    })
    setLiked(prev  => ({ ...prev, ...likedMap }))
    setLikeCounts(prev => ({ ...prev, ...countMap }))
    cursorRef.current = newShorts[newShorts.length - 1].created_at
  }

  // Load the next page of shorts, skipping anything already in the feed
  async function loadMore(currentShorts) {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const excludeIds = currentShorts.map(s => s.id)
      const page = await fetchShortsPage({ limit: PAGE_SIZE, beforeDate: cursorRef.current, excludeIds })
      if (page.length < PAGE_SIZE) setHasMore(false)
      await appendShorts(page)
    } catch (err) { console.error(err) }
    finally { setLoadingMore(false) }
  }

  // Initial load — cancelled flag prevents StrictMode's double-invoke from
  // appending the same shorts twice
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        let batch = []
        if (initialId) {
          const first = await fetchShortById(initialId)
          const rest  = await fetchShortsPage({
            limit: PAGE_SIZE - 1,
            beforeDate: first.created_at,
            excludeIds: [first.id],
          })
          batch = [first, ...rest]
        } else {
          batch = await fetchShortsPage({ limit: PAGE_SIZE })
        }
        if (cancelled) return
        if (batch.length < PAGE_SIZE) setHasMore(false)
        await appendShorts(batch)
      } catch (err) { if (!cancelled) console.error(err) }
      finally { if (!cancelled) setLoading(false) }
    }
    init()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the URL in sync with the active short
  useEffect(() => {
    if (shorts.length === 0) return
    const s = shorts[activeIdx]
    if (s) navigate(`/shorts/${s.id}`, { replace: true })
  }, [activeIdx, shorts]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load next page when the user is 2 shorts from the end
  useEffect(() => {
    if (shorts.length > 0 && activeIdx >= shorts.length - 2) loadMore(shorts)
  }, [activeIdx, shorts.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load comments for active short (cached)
  useEffect(() => {
    if (shorts.length === 0) return
    const short = shorts[activeIdx]
    if (!short) return
    if (commentsByShort[short.id]) return   // already loaded
    setCommentsLoading(true)
    fetchComments(short.id)
      .then(data => setCommentsByShort(prev => ({ ...prev, [short.id]: data })))
      .catch(() => setCommentsByShort(prev => ({ ...prev, [short.id]: [] })))
      .finally(() => setCommentsLoading(false))
  }, [activeIdx, shorts])

  // Detect which short is in view
  useEffect(() => {
    if (shorts.length === 0) return
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
          const idx = Number(entry.target.dataset.idx)
          setActiveIdx(idx)
          // panel stays open — do NOT close commentsOpen
        }
      })
    }, { threshold: 0.7 })
    itemRefs.current.forEach(el => el && obs.observe(el))
    return () => obs.disconnect()
  }, [shorts])

  // Keyboard arrow up/down navigation
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => {
          const next = Math.min(i + 1, shorts.length - 1)
          const h = feedRef.current?.clientHeight ?? 0
          feedRef.current?.scrollTo({ top: next * h, behavior: 'smooth' })
          return next
        })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => {
          const prev = Math.max(i - 1, 0)
          const h = feedRef.current?.clientHeight ?? 0
          feedRef.current?.scrollTo({ top: prev * h, behavior: 'smooth' })
          return prev
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shorts.length])

  // Play/pause based on active short — also fires when shorts first load
  useEffect(() => {
    setPaused(false)
    videoRefs.current.forEach((video, idx) => {
      if (!video) return
      if (idx === activeIdx) {
        video.muted = muted
        video.play().catch(() => {})
      } else {
        video.pause()
        video.currentTime = 0
      }
    })
  }, [activeIdx, shorts])

  // Sync mute
  useEffect(() => {
    const video = videoRefs.current[activeIdx]
    if (video) video.muted = muted
  }, [muted, activeIdx])

  function togglePlayPause() {
    const video = videoRefs.current[activeIdx]
    if (!video) return
    if (video.paused) {
      video.play().catch(() => {})
      setPaused(false)
    } else {
      video.pause()
      setPaused(true)
    }
  }

  function toggleLike(shortId) {
    if (!user) { openAuthModal(); return }
    const nowLiked = !liked[shortId]
    // Optimistic update
    setLiked(prev => ({ ...prev, [shortId]: nowLiked }))
    setLikeCounts(prev => ({ ...prev, [shortId]: (prev[shortId] ?? 0) + (nowLiked ? 1 : -1) }))
    // Persist to DB
    toggleLikeDB(shortId, !nowLiked).catch(() => {
      // Revert on failure
      setLiked(prev => ({ ...prev, [shortId]: !nowLiked }))
      setLikeCounts(prev => ({ ...prev, [shortId]: (prev[shortId] ?? 0) + (nowLiked ? -1 : 1) }))
    })
  }

  async function submitComment(videoId) {
    const body = commentInput.trim()
    if (!body || submitting) return
    setSubmitting(true)
    try {
      const newComment = await postComment(videoId, body)
      setCommentsByShort(prev => ({
        ...prev,
        [videoId]: [newComment, ...(prev[videoId] ?? [])]
      }))
      setCommentInput('')
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      {user && (
        <Link to="/upload?short=1" className={styles.uploadBtn} title="Upload a Short">
          <Plus size={18} />
          <span>Upload Short</span>
        </Link>
      )}

      {loading && (
        <div className={styles.loadingState}>
          <Loader2 size={28} className={styles.spinner} />
        </div>
      )}

      {!loading && shorts.length === 0 && (
        <div className={styles.emptyState}>
          <p>No Shorts yet.</p>
          <Link to="/upload?short=1" className={styles.emptyUploadBtn}>Upload the first one</Link>
        </div>
      )}

      <div className={styles.feed} ref={feedRef}>
        {shorts.map((s, idx) => {
          const comments     = commentsByShort[s.id] ?? []
          const commentCount = comments.length
          const isActive     = idx === activeIdx

          return (
            <div
              key={s.id}
              className={styles.item}
              data-idx={idx}
              ref={el => itemRefs.current[idx] = el}
            >
              {/* Left half — stage + actions */}
              <div className={styles.stageGroup}>
                <div className={styles.stage} onClick={isActive ? togglePlayPause : undefined}>
                  <video
                    ref={el => videoRefs.current[idx] = el}
                    src={s.videoUrl}
                    className={styles.video}
                    loop
                    playsInline
                    muted
                    disablePictureInPicture
                    controlsList="nodownload nofullscreen noremoteplayback"
                  />
                  <div className={styles.gradient} />

                  {isActive && paused && (
                    <div className={styles.pauseIndicator}>
                      <Play size={36} fill="white" />
                    </div>
                  )}

                  <button className={styles.muteBtn} onClick={e => { e.stopPropagation(); setMuted(m => !m) }}>
                    {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>

                  <div className={styles.overlay}>
                    <div className={styles.channelRow}>
                      <img src={s.avatar} alt={s.channel} className={styles.avatar} referrerPolicy="no-referrer" />
                      <span className={styles.channelName}>{s.channel}</span>
                    </div>
                    <p className={styles.title}>{s.title}</p>
                    <p className={styles.meta}>{formatViews(s.views)} views · #{s.category.toLowerCase()}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className={styles.actions}>
                  <div className={styles.actionItem}>
                    <button
                      className={`${styles.actionBtn} ${liked[s.id] ? styles.actionBtnLiked : ''}`}
                      onClick={() => toggleLike(s.id)}
                    >
                      <ThumbsUp size={22} fill={liked[s.id] ? 'currentColor' : 'none'} />
                    </button>
                    <span className={styles.actionLabel}>{formatViews(likeCounts[s.id] ?? 0)}</span>
                  </div>

                  <div className={styles.actionItem}>
                    <button className={styles.actionBtn}>
                      <ThumbsDown size={22} />
                    </button>
                    <span className={styles.actionLabel}>Dislike</span>
                  </div>

                  <div className={styles.actionItem}>
                    <button
                      className={`${styles.actionBtn} ${commentsOpen ? styles.actionBtnActive : ''}`}
                      onClick={() => setCommentsOpen(o => !o)}
                    >
                      <MessageCircle size={22} />
                    </button>
                    <span className={styles.actionLabel}>
                      {isActive && commentCount > 0 ? formatViews(commentCount) : '0'}
                    </span>
                  </div>

                  <div className={styles.actionItem}>
                    <button
                      className={`${styles.actionBtn} ${saved[s.id] ? styles.actionBtnSaved : ''}`}
                      onClick={() => {
                        if (!user) { openAuthModal(); return }
                        setSaved(prev => ({ ...prev, [s.id]: !prev[s.id] }))
                      }}
                    >
                      <Bookmark size={22} fill={saved[s.id] ? 'currentColor' : 'none'} />
                    </button>
                    <span className={styles.actionLabel}>Save</span>
                  </div>

                  <div className={styles.actionItem} style={{ position: 'relative' }} data-share-anchor>
                    <button
                      className={`${styles.actionBtn} ${shareOpenId === s.id ? styles.actionBtnActive : ''}`}
                      onClick={() => setShareOpenId(id => id === s.id ? null : s.id)}
                    >
                      <Share2 size={22} />
                    </button>
                    <span className={styles.actionLabel}>Share</span>

                    {shareOpenId === s.id && (
                      <div className={styles.sharePopover}>
                        <p className={styles.shareTitle}>Share this Short</p>
                        <div className={styles.shareOptions}>
                          {[
                            { label: 'WhatsApp',  color: '#25D366', icon: '💬', href: `https://wa.me/?text=${encodeURIComponent(s.title + ' ' + window.location.href)}` },
                            { label: 'X',         color: '#000',    icon: '𝕏',  href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(s.title)}` },
                            { label: 'Telegram',  color: '#229ED9', icon: '✈️', href: `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(s.title)}` },
                            { label: 'Facebook',  color: '#1877F2', icon: '📘', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}` },
                          ].map(opt => (
                            <a
                              key={opt.label}
                              href={opt.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.shareOption}
                              style={{ '--share-color': opt.color }}
                              onClick={() => setShareOpenId(null)}
                            >
                              <span className={styles.shareOptionIcon}>{opt.icon}</span>
                              <span className={styles.shareOptionLabel}>{opt.label}</span>
                            </a>
                          ))}
                        </div>
                        <button
                          className={`${styles.shareCopyBtn} ${copied ? styles.shareCopied : ''}`}
                          onClick={() => {
                            navigator.clipboard.writeText(window.location.href)
                            setCopied(true)
                            setTimeout(() => { setCopied(false); setShareOpenId(null) }, 1500)
                          }}
                        >
                          {copied ? '✓ Copied!' : '🔗 Copy link'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right half — comments panel, always in DOM when active so transition works */}
              {isActive && (
                <div className={`${styles.commentsPanel} ${!commentsOpen ? styles.commentsPanelClosed : ''}`}>
                  <div className={styles.commentsPanelHeader}>
                    <span className={styles.commentsPanelTitle}>
                      Comments{commentCount > 0 ? ` (${commentCount})` : ''}
                    </span>
                    <button className={styles.commentsPanelClose} onClick={() => setCommentsOpen(false)}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className={styles.commentsList}>
                    {commentsLoading && (
                      <div className={styles.commentsLoading}>
                        <Loader2 size={20} className={styles.spinner} />
                      </div>
                    )}
                    {!commentsLoading && comments.length === 0 && (
                      <p className={styles.noComments}>No comments yet. Be the first!</p>
                    )}
                    {!commentsLoading && comments.map(c => (
                      <CommentThread
                        key={c.id}
                        comment={c}
                        depth={0}
                        videoId={s.id}
                        user={user}
                        openAuthModal={openAuthModal}
                      />
                    ))}
                  </div>
                  {user ? (
                    <div className={styles.commentCompose}>
                      <img src={getAvatarUrl(user)} alt="You" className={styles.composeAvatar} referrerPolicy="no-referrer" />
                      <input
                        className={styles.composeInput}
                        placeholder="Add a comment…"
                        value={commentInput}
                        onChange={e => setCommentInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && submitComment(s.id)}
                        disabled={submitting}
                      />
                      {commentInput.trim() && (
                        <button
                          className={styles.composeSend}
                          onClick={() => submitComment(s.id)}
                          disabled={submitting}
                        >
                          {submitting ? <Loader2 size={14} className={styles.spinner} /> : 'Post'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className={styles.commentSignIn}>
                      <button className={styles.signInBtn} onClick={openAuthModal}>Sign in to comment</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {loadingMore && (
          <div className={styles.loadMoreSpinner}>
            <Loader2 size={22} className={styles.spinner} />
          </div>
        )}
      </div>
    </div>
  )
}
