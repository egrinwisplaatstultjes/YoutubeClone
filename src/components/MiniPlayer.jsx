import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Maximize2, Play, Pause } from 'lucide-react'
import { usePlayer } from '../context/PlayerContext'
import styles from './MiniPlayer.module.css'

export default function MiniPlayer() {
  const { video, miniVisible, dismiss, getEl, mountIn, detach } = usePlayer()
  const navigate     = useNavigate()
  const containerRef = useRef(null)
  const [playing, setPlaying] = useState(false)

  // Mount/unmount persistent video element when mini player shows/hides
  useEffect(() => {
    if (!miniVisible || !containerRef.current) return
    const el = getEl()
    mountIn(containerRef.current)
    el.play().catch(() => {})

    function onPlay()  { setPlaying(true)  }
    function onPause() { setPlaying(false) }
    function onEnded() { setPlaying(false) }
    el.addEventListener('play',  onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    setPlaying(!el.paused)

    return () => {
      el.removeEventListener('play',  onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
      detach()
    }
  }, [miniVisible])

  function togglePlay(e) {
    e.stopPropagation()
    const el = getEl()
    if (el.paused) el.play().catch(() => {})
    else           el.pause()
  }

  function handleExpand(e) {
    e.stopPropagation()
    navigate(`/watch/${video.id}`)
  }

  if (!video) return null

  return (
    <div className={`${styles.wrap} ${!miniVisible ? styles.hidden : ''}`}>
      <div className={styles.videoWrap} onClick={() => navigate(`/watch/${video.id}`)}>
        <div ref={containerRef} className={styles.video} />
      </div>

      <div className={styles.info}>
        <div className={styles.infoText}>
          <p className={styles.title}>{video.title}</p>
          <p className={styles.channel}>{video.channel}</p>
        </div>
        <div className={styles.controls}>
          <button className={styles.btn} onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button className={styles.btn} onClick={handleExpand} title="Expand">
            <Maximize2 size={15} />
          </button>
          <button className={styles.btn} onClick={e => { e.stopPropagation(); dismiss() }} title="Close">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
