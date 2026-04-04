import { useNavigate } from 'react-router-dom'
import { Upload, Radio, Video, Clapperboard } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import styles from './StudioPage.module.css'

export default function StudioPage() {
  const { user, openAuthModal } = useAuth()
  const navigate = useNavigate()

  function guard(path) {
    if (!user) { openAuthModal(); return }
    navigate(path)
  }

  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroInner}>
          <div className={styles.heroIcon}>
            <Clapperboard size={32} />
          </div>
          <h1 className={styles.heroTitle}>Creator Studio</h1>
          <p className={styles.heroSub}>Share your story with the world — upload a video or go live right now.</p>
        </div>
      </div>

      {/* Cards */}
      <div className={styles.cards}>
        {/* Upload */}
        <button className={`${styles.card} ${styles.cardUpload}`} onClick={() => guard('/upload')}>
          <div className={styles.cardBg} />
          <div className={styles.cardIcon}>
            <Upload size={36} />
          </div>
          <div className={styles.cardContent}>
            <h2 className={styles.cardTitle}>Upload Video / Short</h2>
            <p className={styles.cardDesc}>Share a pre-recorded video. Add a title, description, thumbnail, and more.</p>
          </div>
          <div className={styles.cardArrow}>→</div>
        </button>

        {/* Go Live */}
        <button className={`${styles.card} ${styles.cardLive}`} onClick={() => guard('/go-live')}>
          <div className={styles.cardBg} />
          <div className={styles.cardLivePulse} />
          <div className={styles.cardIcon}>
            <Radio size={36} />
          </div>
          <div className={styles.cardContent}>
            <h2 className={styles.cardTitle}>Go Live</h2>
            <p className={styles.cardDesc}>Broadcast to your audience in real-time with live chat and viewer stats.</p>
          </div>
          <div className={styles.cardArrow}>→</div>
        </button>
      </div>

      {/* Tips */}
      <div className={styles.tips}>
        <h3 className={styles.tipsTitle}>Quick Tips</h3>
        <div className={styles.tipsList}>
          <div className={styles.tip}>
            <Video size={16} />
            <span>Keep videos under 15 minutes for best engagement</span>
          </div>
          <div className={styles.tip}>
            <Radio size={16} />
            <span>Go live during peak hours (6–10 PM) for more viewers</span>
          </div>
          <div className={styles.tip}>
            <Upload size={16} />
            <span>Use a custom thumbnail to increase click-through rate</span>
          </div>
        </div>
      </div>
    </div>
  )
}
