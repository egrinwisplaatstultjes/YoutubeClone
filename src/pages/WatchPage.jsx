import { useParams, Link } from 'react-router-dom'
import {
  ThumbsUp, ThumbsDown, Share2, Bookmark, MoreHorizontal,
  BadgeCheck, Send, Loader2, ChevronDown, Flag, Trash2,
} from 'lucide-react'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import DOMPurify from 'dompurify'
import {
  fetchVideo, fetchVideos, fetchLikes, toggleLike, fetchDislike, toggleDislike,
  fetchComments, fetchReplies, postComment, postReply, voteComment,
  incrementViews, isSubscribed, subscribe, unsubscribe, reportVideo, fetchReported, deleteVideo,
} from '../lib/db'
import { timeAgo, formatViews } from '../lib/utils'
import { usePlayer } from '../context/PlayerContext'
import { useAuth } from '../context/AuthContext'
import VideoCard from '../components/VideoCard'
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
  const { user } = useAuth()
  const [video,       setVideo]       = useState(null)
  const [related,     setRelated]     = useState([])
  const [pageLoading, setPageLoading] = useState(true)

  const player       = usePlayer()
  const containerRef = useRef(null)

  useEffect(() => {
    return () => { player.detach(); player.showMini() }
  }, [])

  useEffect(() => {
    setPageLoading(true)
    Promise.all([fetchVideo(id), fetchVideos()]).then(async ([v, all]) => {
      const isOwn = !!(user && v.channelId === user.id)
      const [{ count, liked }, disliked, alreadyReported, subbed] = await Promise.all([
        fetchLikes(v.id),
        fetchDislike(v.id),
        fetchReported(v.id),
        isOwn ? Promise.resolve(false) : isSubscribed(v.channelId),
      ])
      setVideo(v)
      setRelated(all.filter(x => x.id !== id).slice(0, 6))
      setLikeCount(count)
      setLiked(liked)
      setDisliked(disliked)
      setReported(alreadyReported)
      setSubscribed(subbed)
      player.setVideo(v)
      player.hideMini()
      setPageLoading(false)
      incrementViews(id).then(counted => {
        if (!counted) return
        setVideo(prev => {
          if (!prev) return prev
          const newViews = prev.views + 1
          return { ...prev, views: newViews, viewsLabel: formatViews(newViews) }
        })
      })
    })
  }, [id])

  useEffect(() => {
    if (!video || !containerRef.current) return
    const el = player.getEl()
    player.mountIn(containerRef.current, { controls: true })
    el.play().catch(() => {})
    function onTimeUpdate() { player.setCurrentTime(el.currentTime) }
    el.addEventListener('timeupdate', onTimeUpdate)
    return () => el.removeEventListener('timeupdate', onTimeUpdate)
  }, [video?.id])

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
    } else {
      await subscribe(video.channelId, video.channel, video.avatar)
      setSubscribed(true)
    }
    setSubLoading(false)
  }

  // ── Video likes ───────────────────────────────────────────────────────────
  const [liked,          setLiked]          = useState(false)
  const [likeCount,      setLikeCount]      = useState(0)
  const [likeLoading,    setLikeLoading]    = useState(false)
  const [disliked,       setDisliked]       = useState(false)
  const [dislikeLoading, setDislikeLoading] = useState(false)
  const [copied,         setCopied]         = useState(false)


  async function handleLike() {
    if (likeLoading) return
    setLikeLoading(true)
    const nowLiked = await toggleLike(video.id, liked)
    setLiked(nowLiked)
    setLikeCount(c => nowLiked ? c + 1 : c - 1)
    if (nowLiked && disliked) { await toggleDislike(video.id, true); setDisliked(false) }
    setLikeLoading(false)
  }

  async function handleDislike() {
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
    if (!commentText.trim() || submitting) return
    setSubmitting(true)
    try {
      const row = await postComment(video.id, commentText.trim())
      setComments(prev => [row, ...prev])
      setCommentText('')
    } finally { setSubmitting(false) }
  }

  async function handleCommentVote(commentId, vote, currentVote) {
    const newVote = await voteComment(commentId, vote, currentVote)
    setComments(prev => prev.map(c =>
      c.id === commentId ? applyVoteChange(c, vote, currentVote, newVote) : c
    ))
  }

  async function handleReplyVote(threadId, replyId, vote, currentVote) {
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
          <div className={`${styles.playerWrap} ${styles.skel}`} />
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

  const composeAvatar = user?.user_metadata?.avatar_url || 'https://i.pravatar.cc/36?img=33'

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
                src={r.avatar || 'https://i.pravatar.cc/28?img=2'}
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

  return (
    <div className={styles.page}>

      {/* ── Main column ── */}
      <div className={styles.main}>

        {/* Player */}
        <div ref={containerRef} className={styles.playerWrap} />

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
        <div className={styles.comments}>
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
                placeholder="Add a comment..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
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
                        src={c.avatar || 'https://i.pravatar.cc/36?img=1'}
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
      </div>

      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <p className={styles.upNext}>Up Next</p>
        <div className={styles.relatedList}>
          {related.map(v => <VideoCard key={v.id} video={v} />)}
        </div>
      </aside>

    </div>
  )
}
