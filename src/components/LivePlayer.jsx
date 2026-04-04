import { useRef, useState, useEffect, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX, Volume1, Maximize, Minimize, Settings } from 'lucide-react'
import styles from './LivePlayer.module.css'

// Build/reuse a persistent hidden video element for frame capture
const _previewClones = new WeakMap()
function getPreviewClone(key) {
  if (!_previewClones.has(key)) {
    const v = document.createElement('video')
    v.crossOrigin = 'anonymous'
    v.muted       = true
    v.preload     = 'metadata'
    _previewClones.set(key, v)
  }
  return _previewClones.get(key)
}

function captureFrameFromClone(clone, seekTime) {
  return new Promise((resolve) => {
    function doSeek() {
      clone.onseeked = () => {
        try {
          const c = document.createElement('canvas')
          c.width = 160; c.height = 90
          c.getContext('2d').drawImage(clone, 0, 0, 160, 90)
          resolve(c.toDataURL('image/jpeg', 0.7))
        } catch { resolve(null) }
      }
      clone.currentTime = seekTime
    }
    if (clone.readyState >= 1) doSeek()
    else clone.onloadedmetadata = () => { clone.onloadedmetadata = null; doSeek() }
  })
}

function formatBehind(seconds) {
  if (seconds < 60)   return `-${Math.round(seconds)}s`
  if (seconds < 3600) return `-${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
  return `-${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

export default function LivePlayer({ stream, viewerCount = 0, streamEnded = false }) {
  const videoRef        = useRef(null)
  const wrapRef         = useRef(null)
  const barRef          = useRef(null)
  const recorderRef     = useRef(null)
  const chunksRef       = useRef([])
  const blobUrlRef      = useRef(null)
  const activeStreamRef = useRef(null)
  const hideTimerRef    = useRef(null)
  const previewTimerRef = useRef(null)
  const previewCloneKey = useRef({}) // stable object used as WeakMap key

  const [paused,       setPaused]      = useState(false)
  const [muted,        setMuted]       = useState(false)
  const [volume,       setVolume]      = useState(1)
  const [showVol,      setShowVol]     = useState(false)
  const [atLiveEdge,   setAtLiveEdge]  = useState(true)
  const [dvrPos,       setDvrPos]      = useState(1)
  const [dvrSeconds,   setDvrSeconds]  = useState(0)
  const [isFullscreen, setIsFullscreen]= useState(false)
  const [showControls, setShowControls]= useState(true)
  const [settingsOpen, setSettingsOpen]= useState(false)

  // Hover preview tooltip state
  const [preview, setPreview] = useState(null) // { x, pct, frame, label }

  // ── Apply stream to video element ─────────────────────────────────────────
  useEffect(() => {
    if (!stream) return
    if (stream === activeStreamRef.current) return
    activeStreamRef.current = stream
    const el = videoRef.current
    if (el) { el.srcObject = stream; el.play().catch(() => {}) }

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : null
      if (mimeType) {
        chunksRef.current = []
        const rec = new MediaRecorder(stream, { mimeType })
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data)
            setDvrSeconds(chunksRef.current.length * 0.5)
          }
        }
        rec.start(500)
        recorderRef.current = rec
      }
    } catch (_) {}

    return () => { try { recorderRef.current?.stop() } catch (_) {} }
  }, [stream])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.muted = muted; el.volume = volume
  }, [muted, volume])

  useEffect(() => {
    function onChange() { setIsFullscreen(!!document.fullscreenElement) }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    return () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current) }
  }, [])

  const revealControls = useCallback(() => {
    setShowControls(true)
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000)
  }, [])

  // ── Actions ───────────────────────────────────────────────────────────────
  function togglePlay() {
    const el = videoRef.current
    if (!el) return
    if (el.paused) { el.play().catch(() => {}); setPaused(false) }
    else           { el.pause();                setPaused(true) }
  }
  function toggleMute() { setMuted(m => !m) }
  function handleVolume(e) {
    const v = parseFloat(e.target.value)
    setVolume(v); setMuted(v === 0)
  }
  async function goToLive() {
    const el = videoRef.current
    if (!el || !activeStreamRef.current) return
    if (blobUrlRef.current) {
      el.src = ''
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    el.srcObject = activeStreamRef.current
    el.play().catch(() => {})
    setAtLiveEdge(true)
    setDvrPos(1)
  }
  async function handleDvrSeek(e) {
    const pos = parseFloat(e.target.value)
    if (pos >= 0.99) { goToLive(); return }
    const el = videoRef.current
    if (!el || chunksRef.current.length === 0) return
    setAtLiveEdge(false)
    setDvrPos(pos)
    const blob    = new Blob([...chunksRef.current], { type: recorderRef.current?.mimeType || 'video/webm' })
    const blobUrl = URL.createObjectURL(blob)
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    blobUrlRef.current = blobUrl
    el.srcObject = null
    el.src = blobUrl
    el.onloadedmetadata = () => {
      el.currentTime = pos * el.duration
      el.play().catch(() => {})
      el.onloadedmetadata = null
    }
  }
  function toggleFullscreen() {
    if (!document.fullscreenElement) wrapRef.current?.requestFullscreen()
    else document.exitFullscreen()
  }

  // ── DVR bar hover preview ─────────────────────────────────────────────────
  function handleBarHover(e) {
    const bar  = barRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const secondsBehind = (1 - pct) * dvrSeconds
    const label = pct >= 0.99 ? 'Live' : formatBehind(secondsBehind)

    setPreview(p => ({ ...(p || {}), x: e.clientX - rect.left, pct, label, frame: p?.frame ?? null }))

    clearTimeout(previewTimerRef.current)
    previewTimerRef.current = setTimeout(() => {
      const el = videoRef.current
      if (!el || !el.src || el.srcObject) return  // only when in DVR blob mode
      const clone = getPreviewClone(previewCloneKey.current)
      // Re-load only when src changes
      if (clone.dataset.loadedSrc !== el.src) {
        clone.dataset.loadedSrc = el.src
        clone.src = el.src
      }
      const seekT = pct * (el.duration || 0)
      captureFrameFromClone(clone, seekT).then(frame => {
        setPreview(p => p ? { ...p, frame } : null)
      })
    }, 120)
  }
  function handleBarLeave() {
    clearTimeout(previewTimerRef.current)
    setPreview(null)
  }

  function VolumeIcon() {
    if (muted || volume === 0) return <VolumeX size={18} />
    if (volume < 0.5)          return <Volume1 size={18} />
    return                            <Volume2 size={18} />
  }

  return (
    <div
      className={styles.wrap}
      ref={wrapRef}
      onMouseMove={revealControls}
      onMouseLeave={() => { clearTimeout(hideTimerRef.current); setShowControls(false) }}
      onClick={(e) => { if (e.target === videoRef.current || e.target === wrapRef.current) togglePlay() }}
    >
      {streamEnded ? (
        <div className={styles.ended}>
          <div className={styles.endedInner}>
            <div className={styles.endedIcon}>⬛</div>
            <p>Stream has ended</p>
          </div>
        </div>
      ) : (
        <video ref={videoRef} className={styles.video} autoPlay playsInline disablePictureInPicture />
      )}

      {!streamEnded && (
        <div className={`${styles.controls} ${showControls ? styles.controlsVisible : ''}`}>
          {/* DVR scrubber */}
          <div
            className={styles.scrubRow}
            onMouseMove={handleBarHover}
            onMouseLeave={handleBarLeave}
          >
            <input
              ref={barRef}
              type="range"
              min={0} max={1} step={0.001}
              value={atLiveEdge ? 1 : dvrPos}
              onChange={handleDvrSeek}
              className={styles.dvrBar}
              style={{ '--pct': `${(atLiveEdge ? 1 : dvrPos) * 100}%` }}
            />
            {/* Hover tooltip */}
            {preview && (
              <div
                className={styles.previewTooltip}
                style={{ left: `clamp(80px, ${preview.x}px, calc(100% - 80px))` }}
              >
                {preview.frame
                  ? <img src={preview.frame} className={styles.previewThumb} alt="" />
                  : <div className={styles.previewThumbBlank} />
                }
                <span className={styles.previewLabel}>{preview.label}</span>
              </div>
            )}
          </div>

          {/* Button row */}
          <div className={styles.btnRow}>
            <div className={styles.left}>
              <button className={styles.btn} onClick={togglePlay} title={paused ? 'Play' : 'Pause'}>
                {paused ? <Play size={18} fill="white" /> : <Pause size={18} fill="white" />}
              </button>
              <div
                className={styles.volGroup}
                onMouseEnter={() => setShowVol(true)}
                onMouseLeave={() => setShowVol(false)}
              >
                <button className={styles.btn} onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
                  <VolumeIcon />
                </button>
                <div className={`${styles.volSliderWrap} ${showVol ? styles.volSliderVisible : ''}`}>
                  <input
                    type="range" min={0} max={1} step={0.02}
                    value={muted ? 0 : volume}
                    onChange={handleVolume}
                    className={styles.volSlider}
                  />
                </div>
              </div>
              <span className={styles.viewers}>{viewerCount.toLocaleString()} watching</span>
            </div>

            <div className={styles.right}>
              <button
                className={`${styles.liveBtn} ${atLiveEdge ? styles.liveBtnRed : styles.liveBtnGray}`}
                onClick={goToLive}
                disabled={atLiveEdge}
                title={atLiveEdge ? 'You are live' : 'Go to live'}
              >
                <span className={`${styles.liveDot} ${atLiveEdge ? styles.liveDotPulse : ''}`} />
                LIVE
              </button>
              <div className={styles.settingsWrap}>
                <button className={styles.btn} onClick={() => setSettingsOpen(s => !s)} title="Settings">
                  <Settings size={17} />
                </button>
                {settingsOpen && (
                  <div className={styles.settingsMenu} onMouseLeave={() => setSettingsOpen(false)}>
                    <p className={styles.settingsLabel}>Quality</p>
                    <button className={`${styles.settingsItem} ${styles.settingsItemActive}`}>Auto</button>
                  </div>
                )}
              </div>
              <button className={styles.btn} onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
