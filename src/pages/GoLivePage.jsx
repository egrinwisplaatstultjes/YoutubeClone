import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera, Monitor, Radio, Users, Clock, Send, Loader2, StopCircle,
  Mic, MicOff, VideoOff, Video, Signal,
  ChevronDown, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { startBroadcast } from '../lib/liveStream'
import { createLiveStream, uploadFile } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { useLiveStream } from '../context/LiveStreamContext'
import { getAvatarUrl } from '../lib/utils'
import styles from './GoLivePage.module.css'

/** Grab a single video frame and return a JPEG File. */
async function captureFrame(videoEl) {
  const canvas = document.createElement('canvas')
  canvas.width  = videoEl.videoWidth  || 1280
  canvas.height = videoEl.videoHeight || 720
  canvas.getContext('2d').drawImage(videoEl, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(new File([blob], 'thumb.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.85)
  )
}

const CATEGORIES = ['Gaming', 'Music', 'Sports', 'News', 'Education', 'Entertainment', 'Technology', 'Other']
const QUALITIES  = ['1080p', '720p (Recommended)', '480p', '360p']

export default function GoLivePage() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const avatarUrl = getAvatarUrl(user)
  const ctx       = useLiveStream()

  // Setup-only local state
  const [source,       setSource]       = useState('camera')
  const [title,        setTitle]        = useState(ctx.isLive ? ctx.liveTitle    : (ctx.savedSession?.title    ?? ''))
  const [category,     setCategory]     = useState(ctx.isLive ? ctx.liveCategory : (ctx.savedSession?.category ?? 'Entertainment'))
  const [description,  setDescription]  = useState('')
  const [quality,      setQuality]      = useState('720p (Recommended)')
  const [goingLive,    setGoingLive]    = useState(false)
  const [error,        setError]        = useState(null)
  const [micOn,        setMicOn]        = useState(true)
  const [camOn,        setCamOn]        = useState(true)
  const [previewReady, setPreviewReady] = useState(false)
  const [ending,       setEnding]       = useState(false)
  const [chatInput,    setChatInput]    = useState('')
  const [thumbFile,    setThumbFile]    = useState(null)   // manually chosen thumbnail
  const [thumbPreview, setThumbPreview] = useState(null)   // data URL for preview

  // step is driven by context when returning to an active stream
  const step = ctx.isLive ? 'live' : 'setup'

  const previewRef      = useRef(null)
  const liveRef         = useRef(null)
  // Callback ref: attaches stream immediately when the live <video> mounts
  const setLiveRef = useCallback((el) => {
    liveRef.current = el
    if (el && ctx.mediaRef.current) {
      el.srcObject = ctx.mediaRef.current
    }
  }, [])
  const localMediaRef   = useRef(null) // used only during setup preview
  const chatMessagesRef = useRef(null)
  const wentLive        = useRef(ctx.isLive) // stays true once we go live; avoids stale-closure bug

  // Setup preview (only when not already live)
  useEffect(() => {
    if (ctx.isLive) return
    let cancelled = false
    setPreviewReady(false)
    setError(null)

    async function startPreview() {
      try {
        localMediaRef.current?.getTracks().forEach(t => t.stop())
        const stream = source === 'camera'
          ? await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        localMediaRef.current = stream
        if (previewRef.current) previewRef.current.srcObject = stream
        setPreviewReady(true)
      } catch (e) {
        if (!cancelled) setError('Could not access media: ' + e.message)
      }
    }

    startPreview()
    return () => { cancelled = true }
  }, [source, ctx.isLive])

  // Stop preview tracks when going live (context takes ownership of the stream)
  // Toggle mic / cam on preview stream
  useEffect(() => {
    if (!localMediaRef.current) return
    localMediaRef.current.getAudioTracks().forEach(t => { t.enabled = micOn })
  }, [micOn])

  useEffect(() => {
    if (!localMediaRef.current) return
    localMediaRef.current.getVideoTracks().forEach(t => { t.enabled = camOn })
  }, [camOn])

  // Toggle mic / cam on the live stream (via context ref)
  useEffect(() => {
    if (!ctx.isLive) return
    ctx.mediaRef.current?.getAudioTracks().forEach(t => { t.enabled = micOn })
  }, [micOn, ctx.isLive])

  useEffect(() => {
    if (!ctx.isLive) return
    ctx.mediaRef.current?.getVideoTracks().forEach(t => { t.enabled = camOn })
  }, [camOn, ctx.isLive])

  // (stream is attached via the setLiveRef callback ref when the element mounts)

  // Auto-scroll chat
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [ctx.chatMessages])

  // Cleanup preview on unmount only — never stop tracks if we went live
  useEffect(() => {
    return () => {
      if (!wentLive.current) {
        localMediaRef.current?.getTracks().forEach(t => t.stop())
      }
    }
  }, []) // intentionally empty: runs only on unmount, reads ref (not stale closure)

  // Warn user before refreshing while live
  useEffect(() => {
    if (!ctx.isLive) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = 'Your stream is live! Refreshing will interrupt the stream for all viewers.'
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [ctx.isLive])

  async function handleGoLive(isResume = false) {
    if (!title.trim()) { setError('Please add a title before going live.'); return }
    if (!localMediaRef.current) { setError('No media stream available.'); return }
    setGoingLive(true)
    setError(null)
    try {
      let videoId
      if (isResume && ctx.savedSession?.videoId) {
        videoId = ctx.savedSession.videoId
      } else {
        // Capture a thumbnail frame from the preview video
        let thumbnail = null
        try {
          const file = thumbFile || (previewRef.current ? await captureFrame(previewRef.current) : null)
          if (file) {
            const path = `thumbnails/live-${Date.now()}.jpg`
            thumbnail = await uploadFile(path, file)
          }
        } catch {
          // Non-fatal — stream starts without thumbnail
        }
        const video = await createLiveStream({ title: title.trim(), description, category, thumbnail })
        videoId = video.id
      }
      const broadcast = await startBroadcast(videoId, localMediaRef.current, {
        onViewerCount: ctx.onViewerCount,
        onChatMessage: ctx.onChatMessage,
      })
      ctx.startStream({
        media:          localMediaRef.current,
        broadcast,
        videoId,
        title:          title.trim(),
        category,
        existingChat:   isResume ? (ctx.savedSession?.chat ?? []) : [],
        resumeStartTs:  isResume ? (ctx.savedSession?.startTs ?? null) : null,
      })
      wentLive.current  = true
      localMediaRef.current = null // context now owns the stream; prevent accidental cleanup
    } catch (e) {
      setError('Failed to start broadcast: ' + e.message)
      setGoingLive(false)
    }
  }

  async function handleEndStream() {
    if (ending) return
    setEnding(true)
    await ctx.endStream()
    navigate('/')
  }

  function handleSendChat(e) {
    e.preventDefault()
    if (!chatInput.trim()) return
    const msg = {
      author: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Host',
      avatar: avatarUrl,
      body: chatInput.trim(),
      isHost: true,
      ts: Date.now(),
    }
    ctx.sendChat(msg)
    setChatInput('')
  }

  function formatElapsed(s) {
    const h   = Math.floor(s / 3600)
    const m   = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  if (!user) {
    return (
      <div className={styles.gate}>
        <AlertCircle size={40} />
        <h2>Sign in to go live</h2>
        <p>You need an account to broadcast.</p>
      </div>
    )
  }

  /* ───────────────────── LIVE VIEW ───────────────────── */
  if (step === 'live') {
    return (
      <div className={styles.livePage}>
        <div className={styles.liveTopBar}>
          <div className={styles.liveTopLeft}>
            <div className={styles.liveBadgeInline}>
              <span className={styles.liveDot} />
              LIVE
            </div>
            <span className={styles.liveStreamTitle}>{ctx.liveTitle}</span>
          </div>
          <div className={styles.liveTopRight}>
            <div className={styles.liveStatPill}><Signal size={13} /> <span>{quality}</span></div>
            <div className={styles.liveStatPill}><Users size={13} /> <span>{ctx.viewerCount} watching</span></div>
            <div className={styles.liveTimerPill}><Clock size={13} /> <span>{formatElapsed(ctx.elapsed)}</span></div>
            <button className={styles.endStreamBtn} onClick={handleEndStream} disabled={ending}>
              {ending
                ? <><Loader2 size={14} className={styles.spin} /> Ending…</>
                : <><StopCircle size={14} /> End Stream</>}
            </button>
          </div>
        </div>

        <div className={styles.liveMain}>
          <div className={styles.liveVideoColumn}>
            <div className={styles.livePlayerWrap}>
              <video ref={setLiveRef} className={styles.liveVideo} muted autoPlay playsInline />
              <div className={styles.liveOverlayBottomLeft}>
                <div className={styles.liveStreamLabel}>{ctx.liveCategory}</div>
              </div>
              <div className={styles.liveOverlayBottomRight}>
                <Users size={12} /> {ctx.viewerCount}
              </div>
              {!camOn && (
                <div className={styles.camOffOverlay}>
                  <VideoOff size={40} />
                  <span>Camera is off</span>
                </div>
              )}
            </div>

            <div className={styles.liveControls}>
              <div className={styles.liveControlsLeft}>
                <button
                  className={`${styles.controlBtn} ${!micOn ? styles.controlBtnOff : ''}`}
                  onClick={() => setMicOn(m => !m)}
                >
                  {micOn ? <Mic size={16} /> : <MicOff size={16} />}
                  <span>{micOn ? 'Mic On' : 'Muted'}</span>
                </button>
                <button
                  className={`${styles.controlBtn} ${!camOn ? styles.controlBtnOff : ''}`}
                  onClick={() => setCamOn(c => !c)}
                >
                  {camOn ? <Video size={16} /> : <VideoOff size={16} />}
                  <span>{camOn ? 'Cam On' : 'Cam Off'}</span>
                </button>
              </div>
              <div className={styles.liveControlsRight}>
                <div className={styles.liveSignal}>
                  <div className={styles.signalBar} style={{ height: 8 }} />
                  <div className={styles.signalBar} style={{ height: 13 }} />
                  <div className={styles.signalBar} style={{ height: 18 }} />
                  <div className={styles.signalBar} style={{ height: 24 }} />
                </div>
                <span className={styles.liveQualityLabel}>{quality}</span>
              </div>
            </div>
          </div>

          <div className={styles.liveChatPanel}>
            <div className={styles.liveChatPanelHeader}>
              <div className={styles.liveChatPanelTitle}>
                <Radio size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                Live Chat
              </div>
              <span className={styles.liveChatViewers}>{ctx.viewerCount} viewers</span>
            </div>
            <div ref={chatMessagesRef} className={styles.liveChatMessages}>
              {ctx.chatLoading ? (
                <div className={styles.liveChatEmpty}>
                  <Loader2 size={20} className={styles.spin} />
                  <p>Loading chat…</p>
                </div>
              ) : ctx.chatMessages.length === 0 ? (
                <div className={styles.liveChatEmpty}>
                  <p>Chat will appear here once viewers join…</p>
                </div>
              ) : null}
              {ctx.chatMessages.map((m, i) => (
                <div key={i} className={styles.liveChatMsg}>
                  <img
                    src={m.isHost ? avatarUrl : `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(m.author)}`}
                    alt={m.author}
                    className={styles.liveChatAvatar}
                    referrerPolicy="no-referrer"
                  />
                  <div className={styles.liveChatContent}>
                    <span className={styles.liveChatAuthor}>{m.author}</span>
                    {m.isHost && <span className={styles.liveChatHostBadge}>Host</span>}
                    <span className={styles.liveChatBody}>{m.body}</span>
                  </div>
                </div>
              ))}
            </div>
            <form className={styles.liveChatForm} onSubmit={handleSendChat}>
              <input
                className={styles.liveChatInput}
                placeholder="Say something to your viewers…"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                maxLength={200}
              />
              <button type="submit" className={styles.liveChatSendBtn} disabled={!chatInput.trim()}>
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  /* ───────────────────── SETUP VIEW ───────────────────── */
  return (
    <div className={styles.setupPage}>
      {ctx.savedSession && (
        <div className={styles.resumeBanner}>
          <Radio size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span>
            You have an interrupted stream: <strong>{ctx.savedSession.title}</strong>
          </span>
          <button
            className={styles.resumeBtn}
            onClick={() => handleGoLive(true)}
            disabled={goingLive || !previewReady}
          >
            {goingLive ? <Loader2 size={13} className={styles.spin} /> : null}
            Resume
          </button>
          <button className={styles.resumeDiscardBtn} onClick={ctx.clearSavedSession}>
            Discard
          </button>
        </div>
      )}
      <div className={styles.setupHeader}>
        <div className={styles.setupHeaderIcon}>
          <Radio size={18} />
        </div>
        <div>
          <h1 className={styles.setupTitle}>Go Live</h1>
          <p className={styles.setupSubtitle}>Configure your broadcast then hit the button.</p>
        </div>
      </div>

      <div className={styles.setupLayout}>
        <div className={styles.previewCol}>
          <div className={styles.sourceTabs}>
            <button
              className={`${styles.sourceTab} ${source === 'camera' ? styles.sourceTabActive : ''}`}
              onClick={() => setSource('camera')}
            >
              <Camera size={14} /> Camera
            </button>
            <button
              className={`${styles.sourceTab} ${source === 'screen' ? styles.sourceTabActive : ''}`}
              onClick={() => setSource('screen')}
            >
              <Monitor size={14} /> Screen Share
            </button>
          </div>

          <div className={styles.previewWrap}>
            <video ref={previewRef} className={styles.previewVideo} muted autoPlay playsInline />
            {!previewReady && !error && (
              <div className={styles.previewPlaceholder}>
                <Loader2 size={28} className={styles.spin} />
                <span>Waiting for {source === 'camera' ? 'camera' : 'screen'}…</span>
              </div>
            )}
            {previewReady && (
              <div className={styles.previewReadyBadge}>
                <CheckCircle2 size={12} /> Preview
              </div>
            )}
            <div className={styles.previewControls}>
              <button
                className={`${styles.previewControlBtn} ${!micOn ? styles.previewControlOff : ''}`}
                onClick={() => setMicOn(m => !m)}
              >
                {micOn ? <Mic size={14} /> : <MicOff size={14} />}
              </button>
              <button
                className={`${styles.previewControlBtn} ${!camOn ? styles.previewControlOff : ''}`}
                onClick={() => setCamOn(c => !c)}
              >
                {camOn ? <Video size={14} /> : <VideoOff size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <div className={styles.previewError}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className={styles.qualityRow}>
            <Signal size={14} />
            <span className={styles.qualityLabel}>Quality</span>
            <div className={styles.qualitySelect}>
              <select className={styles.qualityDropdown} value={quality} onChange={e => setQuality(e.target.value)}>
                {QUALITIES.map(q => <option key={q}>{q}</option>)}
              </select>
              <ChevronDown size={13} className={styles.qualityChevron} />
            </div>
          </div>
        </div>

        <div className={styles.formCol}>
          <div className={styles.field}>
            <label className={styles.label}>Stream Title <span className={styles.required}>*</span></label>
            <input
              className={styles.input}
              placeholder="What are you streaming today?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={100}
            />
            <span className={styles.charCount}>{title.length}/100</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Category</label>
            <div className={styles.selectWrap}>
              <select className={styles.select} value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <ChevronDown size={13} className={styles.selectChevron} />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              placeholder="Tell viewers what this stream is about…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              maxLength={500}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Thumbnail <span className={styles.optional}>(optional — or we’ll snap one for you)</span></label>
            <label className={styles.thumbUploadLabel}>
              {thumbPreview
                ? <img src={thumbPreview} alt="Thumbnail preview" className={styles.thumbPreviewImg} />
                : <span className={styles.thumbUploadPlaceholder}>Click to choose an image</span>
              }
              <input
                type="file"
                accept="image/*"
                className={styles.thumbUploadInput}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setThumbFile(file)
                  const reader = new FileReader()
                  reader.onload = ev => setThumbPreview(ev.target.result)
                  reader.readAsDataURL(file)
                }}
              />
            </label>
          </div>

          {error && !error.startsWith('Could not') && (
            <div className={styles.errorMsg}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className={styles.statusRow}>
            <div className={`${styles.statusDot} ${previewReady ? styles.statusDotReady : styles.statusDotWaiting}`} />
            <span className={styles.statusText}>{previewReady ? 'Stream preview ready' : 'Waiting for media…'}</span>
          </div>

          <button
            className={styles.goLiveBtn}
            onClick={handleGoLive}
            disabled={goingLive || !title.trim() || !previewReady}
          >
            {goingLive
              ? <><Loader2 size={17} className={styles.spin} /> Starting broadcast…</>
              : <><Radio size={17} /> Start Broadcast</>}
          </button>
        </div>
      </div>
    </div>
  )
}
