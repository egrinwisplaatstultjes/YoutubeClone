import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Play, Eye, History, Sparkles, Upload, LogIn, Loader2,
  Settings, LogOut, TrendingUp, Lightbulb, Award, BarChart2,
  MoreVertical, Pencil, Archive, RotateCcw, Trash2,
} from 'lucide-react'
import { fetchMyVideos, fetchWatchHistory, fetchArchivedVideos, archiveVideo, restoreVideo, deleteVideo } from '../lib/db'
import { formatViews } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import VideoCard from '../components/VideoCard'
import styles from './ProfilePage.module.css'

const TABS = [
  { id: 'videos',   label: 'Videos' },
  { id: 'archived', label: 'Archived' },
  { id: 'history',  label: 'History' },
  { id: 'insights', label: 'AI Insights' },
]

// Derive AI insights from the user's actual video data
function buildInsights(videos) {
  if (videos.length === 0) return null

  const totalViews = videos.reduce((s, v) => s + (Number(v.views) || 0), 0)
  const avgViews   = Math.round(totalViews / videos.length)
  const topVideo   = [...videos].sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0))[0]

  // Category breakdown
  const catMap = {}
  videos.forEach(v => { catMap[v.category] = (catMap[v.category] || 0) + (Number(v.views) || 0) })
  const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  // Simple channel health score 0–100
  const score = Math.min(100, Math.round(
    (Math.log10(totalViews + 1) / 7) * 40 +
    (Math.min(videos.length, 20) / 20) * 30 +
    (Math.log10(avgViews + 1) / 6) * 30
  ))

  const uploadTip = videos.length < 3
    ? 'Upload at least 3 videos to start building an audience. Consistency is key early on.'
    : videos.length < 10
    ? "You're off to a good start. Aim for a regular upload schedule to keep viewers coming back."
    : "Great upload history! Consider batching content to stay ahead of your schedule."

  const viewTip = avgViews < 100
    ? 'Share your videos on social media and communities related to your content to boost early views.'
    : avgViews < 1000
    ? `Your average of ${formatViews(avgViews)} views per video is growing. Strong thumbnails and titles drive click-through.`
    : `${formatViews(avgViews)} average views per video is solid. Double down on what's working in your top content.`

  return { totalViews, avgViews, topVideo, topCat, score, uploadTip, viewTip }
}

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [tab,             setTab]             = useState('videos')
  const [videos,          setVideos]          = useState([])
  const [archived,        setArchived]        = useState([])
  const [history,         setHistory]         = useState([])
  const [loading,         setLoading]         = useState(true)
  const [archivedLoading, setArchivedLoading] = useState(false)
  const [historyLoading,  setHistoryLoading]  = useState(false)
  const [menuOpenId,      setMenuOpenId]      = useState(null)
  const [workingId,       setWorkingId]       = useState(null)
  const [confirmDelete,   setConfirmDelete]   = useState(null)
  const menuRef     = useRef(null)
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetchMyVideos().then(setVideos).finally(() => setLoading(false))
  }, [user])

  // Load archived videos lazily when that tab is opened
  useEffect(() => {
    if (tab !== 'archived' || archived.length > 0) return
    setArchivedLoading(true)
    fetchArchivedVideos().then(setArchived).finally(() => setArchivedLoading(false))
  }, [tab])

  // Load watch history lazily when that tab is opened
  useEffect(() => {
    if (tab !== 'history' || history.length > 0) return
    setHistoryLoading(true)
    fetchWatchHistory().then(setHistory).finally(() => setHistoryLoading(false))
  }, [tab])

  // Close three-dots card menu on outside click
  useEffect(() => {
    if (!menuOpenId) return
    function onOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpenId(null)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [menuOpenId])

  // Close settings menu on outside click
  useEffect(() => {
    if (!showSettings) return
    function onOutside(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setShowSettings(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [showSettings])

  async function handleArchive(id) {
    if (workingId) return
    setMenuOpenId(null)
    setWorkingId(id)
    try {
      await archiveVideo(id)
      setVideos(prev => prev.filter(v => v.id !== id))
      setArchived([]) // invalidate so it reloads fresh next time
    } finally {
      setWorkingId(null)
    }
  }

  async function handleRestore(id) {
    if (workingId) return
    setWorkingId(id)
    try {
      await restoreVideo(id)
      setArchived(prev => prev.filter(v => v.id !== id))
    } finally {
      setWorkingId(null)
    }
  }

  async function handlePermanentDelete(id) {
    if (workingId) return
    setWorkingId(id)
    try {
      await deleteVideo(id)
      setArchived(prev => prev.filter(v => v.id !== id))
    } finally {
      setWorkingId(null)
      setConfirmDelete(null)
    }
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.unauthState}>
          <LogIn size={40} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Sign in to see your channel</p>
          <p className={styles.emptySub}>Upload videos, track your stats, and manage your content.</p>
        </div>
      </div>
    )
  }

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Your Channel'
  const avatarUrl   = user.user_metadata?.avatar_url
  const handle      = '@' + (user.email?.split('@')[0] ?? 'you').toLowerCase().replace(/[^a-z0-9]/g, '')
  const joinedDate  = new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const totalViews  = videos.reduce((s, v) => s + (Number(v.views) || 0), 0)
  const initials    = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const insights    = buildInsights(videos)

  return (
    <div className={styles.page}>

      {/* Banner */}
      <div className={styles.banner}>
        <img src={`https://picsum.photos/seed/${user.id}/1600/280`} alt="" />
        <div className={styles.bannerGrad} />
        <button className={styles.editBanner} onClick={() => navigate('/upload')}>
          <Upload size={13} /> Upload video
        </button>
      </div>

      {/* Channel header */}
      <div className={styles.channelHead}>
        <div className={styles.headInner}>
          <div className={styles.avatarCol}>
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} className={styles.avatar} referrerPolicy="no-referrer" />
              : <div className={styles.avatarFallback}>{initials}</div>
            }
          </div>

          <div className={styles.headInfo}>
            <div className={styles.nameRow}>
              <h1 className={styles.name}>{displayName}</h1>
            </div>
            <p className={styles.handle}>{handle}</p>
            <div className={styles.statsInline}>
              <span><strong>{videos.length}</strong> video{videos.length !== 1 ? 's' : ''}</span>
              <span className={styles.dot}>·</span>
              <span><strong>{formatViews(totalViews)}</strong> total views</span>
              <span className={styles.dot}>·</span>
              <span>Joined {joinedDate}</span>
            </div>

            <div className={styles.actions}>
              <button className={styles.actionBtn} onClick={() => navigate('/upload')}>
                <Upload size={14} /> Upload video
              </button>
              <div className={styles.settingsWrap} ref={settingsRef}>
                <button
                  className={`${styles.iconBtn} ${showSettings ? styles.iconBtnActive : ''}`}
                  onClick={() => setShowSettings(s => !s)}
                  title="Settings"
                >
                  <Settings size={16} />
                </button>
                {showSettings && (
                  <div className={styles.settingsMenu}>
                    <div className={styles.settingsUser}>
                      <p className={styles.settingsName}>{displayName}</p>
                      <p className={styles.settingsEmail}>{user.email}</p>
                    </div>
                    <div className={styles.settingsDivider} />
                    <button
                      className={styles.settingsItem}
                      onClick={() => { setShowSettings(false); signOut() }}
                    >
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <div className={styles.tabInner}>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.id === 'insights' && <Sparkles size={13} style={{ marginRight: 5, color: 'var(--accent)' }} />}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>

        {/* Videos tab */}
        {tab === 'videos' && (
          loading ? (
            <div className={styles.empty}>
              <Loader2 size={28} className={styles.emptyIcon} style={{ animation: 'spin 0.9s linear infinite' }} />
            </div>
          ) : videos.length === 0 ? (
            <div className={styles.empty}>
              <Play size={36} className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>No videos yet</p>
              <p className={styles.emptySub}>Videos you upload will appear here.</p>
              <button className={styles.subBtn} onClick={() => navigate('/upload')}>Upload your first video</button>
            </div>
          ) : (
            <div className={styles.grid}>
              {videos.map(v => (
                <div key={v.id} className={styles.videoWrap}>
                  <VideoCard video={v} />
                  {/* Three-dots menu */}
                  <div
                    className={styles.cardMenuWrap}
                    ref={menuOpenId === v.id ? menuRef : null}
                  >
                    <button
                      className={styles.menuBtn}
                      onClick={e => { e.preventDefault(); setMenuOpenId(id => id === v.id ? null : v.id) }}
                      title="More options"
                      disabled={workingId === v.id}
                    >
                      {workingId === v.id
                        ? <Loader2 size={14} className={styles.spin} />
                        : <MoreVertical size={14} />
                      }
                    </button>
                    {menuOpenId === v.id && (
                      <div className={styles.cardMenu}>
                        <button
                          className={styles.cardMenuItem}
                          onClick={() => { setMenuOpenId(null); navigate(`/edit/${v.id}`) }}
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          className={styles.cardMenuItem}
                          onClick={() => handleArchive(v.id)}
                        >
                          <Archive size={13} /> Archive
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Archived tab */}
        {tab === 'archived' && (
          archivedLoading ? (
            <div className={styles.empty}>
              <Loader2 size={28} className={styles.emptyIcon} style={{ animation: 'spin 0.9s linear infinite' }} />
            </div>
          ) : archived.length === 0 ? (
            <div className={styles.empty}>
              <Archive size={36} className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>No archived videos</p>
              <p className={styles.emptySub}>Archived videos are hidden from your channel but saved here.</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {archived.map(v => (
                <div key={v.id} className={styles.videoWrap}>
                  <div className={styles.archivedOverlay}>
                    <span className={styles.archivedBadge}><Archive size={11} /> Archived</span>
                  </div>
                  <VideoCard video={v} />
                  {confirmDelete === v.id ? (
                    <div className={styles.deleteConfirm}>
                      <p className={styles.deleteConfirmText}>Delete permanently?</p>
                      <div className={styles.deleteConfirmBtns}>
                        <button
                          className={styles.deleteConfirmCancel}
                          onClick={() => setConfirmDelete(null)}
                          disabled={workingId === v.id}
                        >
                          Cancel
                        </button>
                        <button
                          className={styles.deleteConfirmOk}
                          onClick={() => handlePermanentDelete(v.id)}
                          disabled={workingId === v.id}
                        >
                          {workingId === v.id
                            ? <Loader2 size={13} className={styles.spin} />
                            : 'Delete'
                          }
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.archivedActions}>
                      <button
                        className={styles.restoreBtn}
                        onClick={() => handleRestore(v.id)}
                        disabled={!!workingId}
                        title="Restore video"
                      >
                        {workingId === v.id
                          ? <Loader2 size={12} className={styles.spin} />
                          : <><RotateCcw size={12} /> Restore</>
                        }
                      </button>
                      <button
                        className={styles.deletePermBtn}
                        onClick={e => { e.preventDefault(); setConfirmDelete(v.id) }}
                        disabled={!!workingId}
                        title="Delete permanently"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* History tab */}
        {tab === 'history' && (
          historyLoading ? (
            <div className={styles.empty}>
              <Loader2 size={28} className={styles.emptyIcon} style={{ animation: 'spin 0.9s linear infinite' }} />
            </div>
          ) : history.length === 0 ? (
            <div className={styles.empty}>
              <History size={36} className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>No watch history yet</p>
              <p className={styles.emptySub}>Videos you watch will appear here.</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {history.map(v => <VideoCard key={v.id} video={v} />)}
            </div>
          )
        )}

        {/* AI Insights tab */}
        {tab === 'insights' && (
          loading ? (
            <div className={styles.empty}>
              <Loader2 size={28} className={styles.emptyIcon} style={{ animation: 'spin 0.9s linear infinite' }} />
            </div>
          ) : !insights ? (
            <div className={styles.empty}>
              <Sparkles size={36} className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>Upload your first video to unlock AI insights</p>
              <p className={styles.emptySub}>Once you have videos, Wavr AI will analyze your channel performance.</p>
              <button className={styles.subBtn} onClick={() => navigate('/upload')}>Upload a video</button>
            </div>
          ) : (
            <div className={styles.insightsGrid}>

              {/* Score card */}
              <div className={`${styles.insightCard} ${styles.insightCardAccent}`}>
                <div className={styles.insightCardTop}>
                  <Award size={18} className={styles.insightIcon} />
                  <span className={styles.insightLabel}>Channel Score</span>
                </div>
                <div className={styles.scoreRow}>
                  <span className={styles.scoreBig}>{insights.score}</span>
                  <span className={styles.scoreMax}>/100</span>
                </div>
                <div className={styles.scoreBar}>
                  <div className={styles.scoreBarFill} style={{ width: `${insights.score}%` }} />
                </div>
                <p className={styles.insightSub}>
                  {insights.score >= 70 ? 'Strong channel — keep it up!' :
                   insights.score >= 40 ? 'Growing well — consistency will push this higher.' :
                   'Early stage — every video improves your score.'}
                </p>
              </div>

              {/* Stats card */}
              <div className={styles.insightCard}>
                <div className={styles.insightCardTop}>
                  <BarChart2 size={18} className={styles.insightIcon} />
                  <span className={styles.insightLabel}>Performance</span>
                </div>
                <div className={styles.statsList}>
                  <div className={styles.statRow}>
                    <span className={styles.statKey}>Total views</span>
                    <span className={styles.statVal}>{formatViews(insights.totalViews)}</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statKey}>Avg per video</span>
                    <span className={styles.statVal}>{formatViews(insights.avgViews)}</span>
                  </div>
                  {insights.topCat && (
                    <div className={styles.statRow}>
                      <span className={styles.statKey}>Top category</span>
                      <span className={styles.statVal}>{insights.topCat}</span>
                    </div>
                  )}
                  <div className={styles.statRow}>
                    <span className={styles.statKey}>Videos uploaded</span>
                    <span className={styles.statVal}>{videos.length}</span>
                  </div>
                </div>
              </div>

              {/* Top video */}
              {insights.topVideo && (
                <div className={styles.insightCard}>
                  <div className={styles.insightCardTop}>
                    <TrendingUp size={18} className={styles.insightIcon} />
                    <span className={styles.insightLabel}>Top Video</span>
                  </div>
                  <div className={styles.topVideoWrap}>
                    <img src={insights.topVideo.thumbnail} alt={insights.topVideo.title} className={styles.topVideoThumb} />
                    <div className={styles.topVideoInfo}>
                      <p className={styles.topVideoTitle}>{insights.topVideo.title}</p>
                      <p className={styles.topVideoViews}><Eye size={12} /> {formatViews(insights.topVideo.views)} views</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload tip */}
              <div className={styles.insightCard}>
                <div className={styles.insightCardTop}>
                  <Lightbulb size={18} className={styles.insightIcon} />
                  <span className={styles.insightLabel}>AI Tip · Upload</span>
                </div>
                <p className={styles.insightTip}>{insights.uploadTip}</p>
              </div>

              {/* Views tip */}
              <div className={styles.insightCard}>
                <div className={styles.insightCardTop}>
                  <Sparkles size={18} className={styles.insightIcon} />
                  <span className={styles.insightLabel}>AI Tip · Growth</span>
                </div>
                <p className={styles.insightTip}>{insights.viewTip}</p>
              </div>

            </div>
          )
        )}
      </div>
    </div>
  )
}
