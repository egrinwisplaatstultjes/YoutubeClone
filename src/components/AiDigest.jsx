import { useState } from 'react'
import { Bot, Shuffle, ChevronDown, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import styles from './AiDigest.module.css'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 5)  return 'Still up late?'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return       'Night owl mode'
}

const insights = [
  { icon: '🔥', text: 'Tech is surging — 3 new uploads in the last 6 hours.' },
  { icon: '🎵', text: 'ChillVibes is live with 4.8M watching right now.' },
  { icon: '📈', text: 'Sports content is trending +240% this week — NBA season.' },
  { icon: '🧠', text: 'Two new Science uploads match your usual viewing patterns.' },
]

const surpriseReasons = [
  'Trending hard in its category and matches your recent history.',
  'Short, high quality, and you probably haven\'t seen it yet.',
  'Unusually high finish rate — audiences watch this one all the way through.',
  'Picked based on the time of day and what people like you are watching.',
]

export default function AiDigest({ videos = [] }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState(null)

  function handleSurprise() {
    const video = videos[Math.floor(Math.random() * videos.length)]
    const reason = surpriseReasons[Math.floor(Math.random() * surpriseReasons.length)]
    setPick({ video, reason })
    if (!open) setOpen(true)
  }

  return (
    <div className={styles.wrap}>
      {/* Always-visible bar */}
      <div className={styles.bar}>
        <div className={styles.barLeft}>
          <div className={styles.botIcon}><Bot size={13} /></div>
          <span className={styles.barLabel}>{getGreeting()} — AI Daily Brief</span>
        </div>
        <div className={styles.barRight}>
          <button className={styles.surpriseBtn} onClick={handleSurprise}>
            <Shuffle size={13} /> Surprise me
          </button>
          <button className={styles.toggleBtn} onClick={() => setOpen(o => !o)}>
            <ChevronDown size={14} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
            {open ? 'Hide' : 'What\'s on'}
          </button>
        </div>
      </div>

      {/* Expandable content */}
      {open && (
        <div className={styles.body}>
          {/* Surprise pick */}
          {pick && (
            <div className={styles.pickSection}>
              <p className={styles.pickHeading}><Zap size={12} /> AI Pick for you right now</p>
              <div className={styles.pickCard} onClick={() => navigate(`/watch/${pick.video.id}`)}>
                <img src={pick.video.thumbnail} alt={pick.video.title} className={styles.pickThumb} />
                <div className={styles.pickInfo}>
                  <p className={styles.pickTitle}>{pick.video.title}</p>
                  <p className={styles.pickChannel}>{pick.video.channel} · {pick.video.duration}</p>
                  <p className={styles.pickReason}>{pick.reason}</p>
                  <span className={styles.pickCta}>Watch now →</span>
                </div>
              </div>
            </div>
          )}

          {/* Insights */}
          <div className={styles.insights}>
            <p className={styles.insightsLabel}>Trending on Wavr right now</p>
            <div className={styles.insightGrid}>
              {insights.map((ins, i) => (
                <div key={i} className={styles.insight}>
                  <span>{ins.icon}</span>
                  <p>{ins.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
