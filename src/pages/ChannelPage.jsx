import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BadgeCheck, Bell, Share2, MoreHorizontal, Play, Eye, Heart, Loader2 } from 'lucide-react'
import { fetchVideosByChannelId, isSubscribed, subscribe, unsubscribe } from '../lib/db'
import { formatViews } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import VideoCard from '../components/VideoCard'
import styles from './ProfilePage.module.css'

const TABS = [
  { id: 'videos', label: 'Videos' },
  { id: 'about',  label: 'About' },
]

export default function ChannelPage() {
  const { channelId } = useParams()
  const { user }      = useAuth()
  const navigate      = useNavigate()

  const [tab,        setTab]        = useState('videos')
  const [videos,     setVideos]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [subscribed,  setSubscribed]  = useState(false)
  const [subLoading,  setSubLoading]  = useState(false)
  const [bellOn,      setBellOn]      = useState(false)

  // If this is the logged-in user's own channel, redirect to /profile
  useEffect(() => {
    if (user && channelId === user.id) {
      navigate('/profile', { replace: true })
    }
  }, [user, channelId])

  useEffect(() => {
    setLoading(true)
    fetchVideosByChannelId(channelId)
      .then(setVideos)
      .finally(() => setLoading(false))
  }, [channelId])

  useEffect(() => {
    isSubscribed(channelId).then(setSubscribed)
  }, [channelId])

  async function handleSubscribe() {
    if (subLoading) return
    setSubLoading(true)
    if (subscribed) {
      await unsubscribe(channelId)
      setSubscribed(false)
      setBellOn(false)
    } else {
      await subscribe(channelId, channelName, channelAvatar ?? '')
      setSubscribed(true)
    }
    setSubLoading(false)
  }

  // Derive channel info from the first video
  const channel = videos[0] ?? null
  const channelName   = channel?.channel  ?? 'Channel'
  const channelAvatar = channel?.avatar   ?? null
  const isVerified    = channel?.verified ?? false
  const totalViews    = videos.reduce((sum, v) => sum + (Number(v.views) || 0), 0)
  const initials      = channelName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className={styles.page}>

      {/* Banner */}
      <div className={styles.banner}>
        <img src={`https://picsum.photos/seed/${channelId}/1600/280`} alt="" />
        <div className={styles.bannerGrad} />
      </div>

      {/* Channel header */}
      <div className={styles.channelHead}>
        <div className={styles.headInner}>
          <div className={styles.avatarCol}>
            {channelAvatar
              ? <img src={channelAvatar} alt={channelName} className={styles.avatar} />
              : <div className={styles.avatarFallback}>{initials}</div>
            }
          </div>

          <div className={styles.headInfo}>
            <div className={styles.nameRow}>
              <h1 className={styles.name}>{channelName}</h1>
              {isVerified && <BadgeCheck size={20} className={styles.badge} />}
            </div>
            <p className={styles.handle}>@{channelName.toLowerCase().replace(/\s+/g, '')}</p>
            <div className={styles.statsInline}>
              <span><strong>{videos.length}</strong> video{videos.length !== 1 ? 's' : ''}</span>
              <span className={styles.dot}>·</span>
              <span><strong>{formatViews(totalViews)}</strong> total views</span>
            </div>

            <div className={styles.actions}>
              <button
                className={`${styles.subBtn} ${subscribed ? styles.subBtnActive : ''}`}
                onClick={handleSubscribe}
                disabled={subLoading}
              >
                {subscribed ? 'Subscribed' : 'Subscribe'}
              </button>
              {subscribed && (
                <button
                  className={`${styles.bellBtn} ${bellOn ? styles.bellBtnActive : ''}`}
                  onClick={() => setBellOn(b => !b)}
                  title={bellOn ? 'Turn off notifications' : 'Turn on notifications'}
                >
                  <Bell size={15} fill={bellOn ? 'currentColor' : 'none'} />
                </button>
              )}
              <button className={styles.actionBtn}><Share2 size={14} /> Share</button>
              <button className={styles.iconBtn}><MoreHorizontal size={16} /></button>
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
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {tab === 'videos' && (
          <>
            {loading ? (
              <div className={styles.empty}>
                <Loader2 size={28} className={styles.emptyIcon} style={{ animation: 'spin 0.9s linear infinite' }} />
              </div>
            ) : videos.length === 0 ? (
              <div className={styles.empty}>
                <Play size={36} className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>No videos yet</p>
                <p className={styles.emptySub}>This channel hasn't uploaded any videos.</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {videos.map(v => <VideoCard key={v.id} video={v} />)}
              </div>
            )}
          </>
        )}

        {tab === 'about' && (
          <div className={styles.about}>
            <div className={styles.aboutCard}>
              <h3 className={styles.aboutHeading}>About</h3>
              <p className={styles.aboutDesc}>{channelName}'s channel on Velora.</p>
              <div className={styles.aboutStats}>
                <div className={styles.aboutStat}>
                  <Eye size={15} /> <span>{formatViews(totalViews)} total views</span>
                </div>
                <div className={styles.aboutStat}>
                  <Heart size={15} /> <span>{videos.length} video{videos.length !== 1 ? 's' : ''} uploaded</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
