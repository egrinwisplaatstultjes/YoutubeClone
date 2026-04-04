import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Sparkles } from 'lucide-react'
import { useThumbColor } from '../lib/useThumbColor'
import { useLiveViewerCount } from '../lib/useLiveViewerCount'
import styles from './VideoCard.module.css'

export default function VideoCard({ video, aiMatch, layout }) {
  const isLive    = video.duration === 'LIVE'
  const isRow     = layout === 'row'
  const thumbColor = useThumbColor(video.thumbnail)
  const [hovered, setHovered] = useState(false)
  const liveViewers = useLiveViewerCount(isLive ? video.id : null)

  return (
    <div
      className={`${styles.card} ${isRow ? styles.cardRow : ''}`}
      style={{ background: hovered && thumbColor ? thumbColor : undefined }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link to={`/watch/${video.id}`} className={`${styles.thumb} ${isRow ? styles.thumbRow : ''}`} tabIndex={-1}>
        <img src={video.thumbnail} alt={video.title} loading="lazy" />
        <div className={styles.thumbOverlay} />
        <span className={`${styles.dur} ${isLive ? styles.live : ''}`}>
          {isLive ? '● LIVE' : video.duration}
        </span>
        {aiMatch && (
          <div className={styles.aiChip}>
            <Sparkles size={9} />
            {aiMatch.score}% match
          </div>
        )}
      </Link>

      <div className={styles.body}>
        <Link to={`/channel/${video.channelId}`} className={styles.avatarLink}>
          <img src={video.avatar} alt={video.channel} className={styles.avatar} />
        </Link>
        <div className={`${styles.info} ${isRow ? styles.bodyRow : ''}`}>
          <Link to={`/watch/${video.id}`} className={styles.titleLink}>
            <h3 className={`${styles.title} ${isRow ? styles.titleRow : ''}`}>{video.title}</h3>
          </Link>
          <Link to={`/channel/${video.channelId}`} className={styles.channelLink}>
            <p className={styles.channel}>
              {video.channel}
              {video.verified && <BadgeCheck size={12} className={styles.check} />}
            </p>
          </Link>
          <p className={styles.meta}>
            {isLive
              ? `${liveViewers.toLocaleString()} watching`
              : `${video.viewsLabel} views · ${video.timeAgo}`
            }
          </p>
          {aiMatch && (
            <p className={styles.aiReason}>
              <Sparkles size={10} className={styles.aiIcon} />
              {aiMatch.reason}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
