import { useState, useEffect, useMemo } from 'react'
import { Sparkles, X, Loader2, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { categories, moods, getAiMatches } from '../data/mockData'
import { fetchVideos, getCachedVideos, fetchShorts } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import VideoCard from '../components/VideoCard'
import AiDigest from '../components/AiDigest'
import styles from './Home.module.css'

export default function Home() {
  const { user } = useAuth()
  const aiEnabled = !!user && user?.user_metadata?.pref_ai_features !== false

  const [videos,  setVideos]  = useState(() => getCachedVideos() ?? [])
  const [loading, setLoading] = useState(() => !getCachedVideos())
  const [shorts,  setShorts]  = useState([])
  const [category,    setCategory]    = useState('All')
  const [activeMood,  setActiveMood]  = useState(null)
  const currentMood = moods.find(m => m.id === activeMood)

  useEffect(() => {
    fetchVideos()
      .then(setVideos)
      .finally(() => setLoading(false))
    fetchShorts().then(setShorts).catch(() => {})
  }, [])

  const aiMatches = useMemo(() => getAiMatches(videos, activeMood), [videos, activeMood])

  const filtered = useMemo(() => {
    let list = category === 'All' ? videos : videos.filter(v => v.category === category)
    if (activeMood) {
      list = [...list].sort((a, b) => (aiMatches[b.id]?.score ?? 0) - (aiMatches[a.id]?.score ?? 0))
    }
    return list
  }, [videos, category, activeMood, aiMatches])

  return (
    <div className={styles.page}>

      {aiEnabled && <AiDigest videos={videos} />}

      {/* Nova Mood Feed */}
      {aiEnabled && <div className={styles.moodSection}>
        <div className={styles.moodHeader}>
          <div className={styles.moodHeading}>
            <Sparkles size={15} className={styles.sparkle} />
            <span>Nova Mood Feed</span>
          </div>
          <p className={styles.moodSub}>Tell us your vibe — we'll sort your feed around it</p>
        </div>

        <div className={styles.moodPills}>
          {moods.map(m => (
            <button
              key={m.id}
              className={`${styles.moodPill} ${activeMood === m.id ? styles.moodActive : ''}`}
              style={activeMood === m.id ? { '--mood-color': m.color } : {}}
              onClick={() => setActiveMood(prev => prev === m.id ? null : m.id)}
            >
              <span className={styles.moodEmoji}>{m.emoji}</span>
              <span className={styles.moodLabel}>{m.label}</span>
              <span className={styles.moodDesc}>{m.desc}</span>
            </button>
          ))}
        </div>

        {activeMood && (
          <div className={styles.moodBanner} style={{ '--mood-color': currentMood.color }}>
            <div className={styles.moodBannerLeft}>
              <span className={styles.moodBannerEmoji}>{currentMood.emoji}</span>
              <div>
                <div className={styles.moodBannerTitle}>{currentMood.label} mode is on</div>
                <div className={styles.moodBannerText}>
                  Your feed is sorted by AI match score. Videos with a purple badge are tuned to your vibe.
                </div>
              </div>
            </div>
            <button className={styles.moodClose} onClick={() => setActiveMood(null)}>
              <X size={14} /> Clear mood
            </button>
          </div>
        )}
      </div>}

      {/* Category chips */}
      <div className={styles.chips}>
        {categories.map(cat => (
          <button
            key={cat}
            className={`${styles.chip} ${category === cat ? styles.chipActive : ''}`}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className={styles.loadingState}>
          <Loader2 size={28} className={styles.spinner} />
          <p>Loading videos…</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map(video => (
            <VideoCard
              key={video.id}
              video={video}
              aiMatch={activeMood ? aiMatches[video.id] : null}
            />
          ))}
        </div>
      )}

      {/* Shorts row — below main grid */}
      <div className={styles.shortsSection}>
        <div className={styles.shortsSectionHeader}>
          <span className={styles.shortsSectionTitle}>Shorts</span>
          <Link to="/shorts" className={styles.shortsSeeAll}>
            See all <ChevronRight size={14} />
          </Link>
        </div>
        <div className={styles.shortsRow}>
          {shorts.slice(0, 5).map(s => (
            <Link key={s.id} to={`/shorts/${s.id}`} className={styles.shortCard}>
              <div className={styles.shortThumbWrap}>
                <img
                  src={s.thumbnail}
                  alt={s.title}
                  className={styles.shortThumb}
                />
                <span className={styles.shortDuration}>{s.duration}</span>
              </div>
              <p className={styles.shortTitle}>{s.title}</p>
              <p className={styles.shortMeta}>@{s.channel.replace(/\s+/g, '').toLowerCase()}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
