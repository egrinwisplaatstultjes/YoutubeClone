import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, ImagePlus, Video, X, Loader2, CheckCircle2, AlertTriangle, Minimize2 } from 'lucide-react'
import { createVideo, uploadFile } from '../lib/db'
import { categories } from '../data/mockData'
import RichEditor from '../components/RichEditor'
import styles from './UploadPage.module.css'

const THUMB_MAX_MB    = 50
const THUMB_MAX_BYTES = THUMB_MAX_MB * 1024 * 1024
const VIDEO_MAX_MB    = 2048  // 2 GB — raise your Supabase bucket limit to match
const VIDEO_MAX_BYTES = VIDEO_MAX_MB * 1024 * 1024

const MOOD_TAGS = ['chill', 'focused', 'curious', 'energized', 'hype']

function formatDuration(seconds) {
  if (!isFinite(seconds)) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

// Compress a thumbnail to JPEG via canvas — near-instant for any image
async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width: w, height: h } = img
      const MAX = 1920
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        blob => resolve(new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' })),
        'image/jpeg',
        0.85
      )
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export default function UploadPage() {
  const navigate = useNavigate()

  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [category,    setCategory]    = useState('Tech')
  const [tags,        setTags]        = useState([])

  const [thumbFile,       setThumbFile]       = useState(null)
  const [thumbPreview,    setThumbPreview]    = useState(null)
  const [thumbOversize,   setThumbOversize]   = useState(false)
  const [compressingThumb, setCompressingThumb] = useState(false)

  const [videoFile,     setVideoFile]     = useState(null)
  const [duration,      setDuration]      = useState('')
  const [videoOversize, setVideoOversize] = useState(false)

  const [thumbProgress, setThumbProgress] = useState(0)
  const [videoProgress, setVideoProgress] = useState(0)
  const [status,        setStatus]        = useState('idle') // idle | uploading | done | error
  const [error,         setError]         = useState('')

  const thumbInputRef = useRef()
  const videoInputRef = useRef()

  function onThumbChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setThumbFile(file)
    setThumbPreview(URL.createObjectURL(file))
    setThumbOversize(file.size > THUMB_MAX_BYTES)
  }

  function onVideoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoFile(file)
    setVideoOversize(file.size > VIDEO_MAX_BYTES)
    const url = URL.createObjectURL(file)
    const vid  = document.createElement('video')
    vid.preload = 'metadata'
    vid.onloadedmetadata = () => { setDuration(formatDuration(vid.duration)); URL.revokeObjectURL(url) }
    vid.src = url
  }

  async function handleCompressThumb() {
    if (!thumbFile || compressingThumb) return
    setCompressingThumb(true)
    setError('')
    try {
      const compressed = await compressImage(thumbFile)
      setThumbFile(compressed)
      setThumbPreview(URL.createObjectURL(compressed))
      setThumbOversize(compressed.size > THUMB_MAX_BYTES)
    } catch {
      setError('Failed to compress thumbnail. Please try a different image.')
    } finally {
      setCompressingThumb(false)
    }
  }

  function toggleTag(tag) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim())  { setError('Please add a title.'); return }
    if (!videoFile)     { setError('Please select a video file.'); return }
    if (!thumbFile)     { setError('Please select a thumbnail image.'); return }
    if (thumbOversize)  { setError('Please compress your thumbnail first.'); return }
    if (videoOversize)  { setError(`Video exceeds the ${VIDEO_MAX_MB / 1024} GB limit.`); return }

    setError('')
    setStatus('uploading')

    try {
      const id = crypto.randomUUID()

      const thumbExt = thumbFile.name.split('.').pop()
      const thumbUrl = await uploadFile(
        `thumbnails/${id}.${thumbExt}`,
        thumbFile,
        pct => setThumbProgress(pct)
      )

      const videoExt = videoFile.name.split('.').pop()
      const videoUrl = await uploadFile(
        `videos/${id}.${videoExt}`,
        videoFile,
        pct => setVideoProgress(pct)
      )

      const video = await createVideo({
        title:       title.trim(),
        description: description.trim(),
        category,
        tags,
        thumbnail:   thumbUrl,
        videoUrl,
        duration:    duration || '0:00',
      })

      setStatus('done')
      setTimeout(() => navigate(`/watch/${video.id}`), 1200)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Upload failed. Please try again.')
      setStatus('idle')
    }
  }

  const uploading = status === 'uploading'
  const done      = status === 'done'

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.heading}>Upload a video</h1>

        <form className={styles.form} onSubmit={handleSubmit}>

          {/* ── Two drop zones ── */}
          <div className={styles.dropRow}>

            {/* Thumbnail */}
            <div className={styles.dropCol}>
              <div
                className={`${styles.dropZone} ${thumbPreview ? styles.dropZoneHasFile : ''} ${thumbOversize ? styles.dropZoneWarn : ''}`}
                onClick={() => thumbInputRef.current.click()}
              >
                {thumbPreview ? (
                  <>
                    <img src={thumbPreview} className={styles.thumbPreview} alt="Thumbnail preview" />
                    <button
                      type="button"
                      className={styles.clearFile}
                      onClick={e => { e.stopPropagation(); setThumbFile(null); setThumbPreview(null); setThumbOversize(false) }}
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <ImagePlus size={28} className={styles.dropIcon} />
                    <p className={styles.dropLabel}>Thumbnail</p>
                    <p className={styles.dropSub}>Click to upload · max {THUMB_MAX_MB} MB</p>
                  </>
                )}
                <input ref={thumbInputRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={onThumbChange} />
              </div>

              {thumbOversize && (
                <div className={styles.oversizeBar}>
                  <AlertTriangle size={14} className={styles.oversizeIcon} />
                  <span className={styles.oversizeText}>
                    {(thumbFile.size / 1024 / 1024).toFixed(1)} MB — exceeds {THUMB_MAX_MB} MB
                  </span>
                  <button
                    type="button"
                    className={styles.compressBtn}
                    onClick={handleCompressThumb}
                    disabled={compressingThumb}
                  >
                    {compressingThumb
                      ? <><Loader2 size={12} className={styles.spin} /> Compressing…</>
                      : <><Minimize2 size={12} /> Compress</>
                    }
                  </button>
                </div>
              )}
            </div>

            {/* Video file */}
            <div className={styles.dropCol}>
              <div
                className={`${styles.dropZone} ${videoFile ? styles.dropZoneHasFile : ''} ${videoOversize ? styles.dropZoneWarn : ''}`}
                onClick={() => !videoFile && videoInputRef.current.click()}
              >
                {videoFile ? (
                  <div className={styles.videoFileInfo}>
                    <Video size={26} className={styles.videoFileIcon} />
                    <p className={styles.videoFileName}>{videoFile.name}</p>
                    <p className={styles.videoFileMeta}>
                      {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                      {duration && ` · ${duration}`}
                    </p>
                    <button
                      type="button"
                      className={styles.clearFile}
                      onClick={e => { e.stopPropagation(); setVideoFile(null); setDuration(''); setVideoOversize(false) }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={28} className={styles.dropIcon} />
                    <p className={styles.dropLabel}>Video file</p>
                    <p className={styles.dropSub}>MP4, MOV, WebM · max 2 GB</p>
                  </>
                )}
                <input ref={videoInputRef} type="file" accept="video/*" className={styles.hiddenInput} onChange={onVideoChange} />
              </div>

              {videoOversize && (
                <div className={styles.oversizeBar}>
                  <AlertTriangle size={14} className={styles.oversizeIcon} />
                  <span className={styles.oversizeText}>
                    {(videoFile.size / 1024 / 1024 / 1024).toFixed(2)} GB — exceeds 2 GB limit
                  </span>
                </div>
              )}
            </div>

          </div>

          {/* ── Fields ── */}
          <div className={styles.fields}>

            <div className={styles.field}>
              <label className={styles.label}>Title <span className={styles.req}>*</span></label>
              <input
                className={styles.input}
                placeholder="Give your video a title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={120}
              />
              <span className={styles.charCount}>{title.length}/120</span>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Description</label>
              <RichEditor
                value={description}
                onChange={setDescription}
                placeholder="Tell viewers what your video is about"
              />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>Category</label>
                <select className={styles.select} value={category} onChange={e => setCategory(e.target.value)}>
                  {categories.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Mood tags</label>
                <div className={styles.tagRow}>
                  {MOOD_TAGS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      className={`${styles.tagBtn} ${tags.includes(tag) ? styles.tagBtnOn : ''}`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Upload progress ── */}
          {uploading && (
            <div className={styles.progressSection}>
              <ProgressBar label="Thumbnail" pct={thumbProgress} />
              <ProgressBar label="Video"     pct={videoProgress} />
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          {/* ── Submit ── */}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => navigate(-1)}
              disabled={uploading || compressingThumb}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={uploading || done || compressingThumb || thumbOversize || videoOversize}
            >
              {done ? (
                <><CheckCircle2 size={15} /> Published!</>
              ) : uploading ? (
                <><Loader2 size={15} className={styles.spin} /> Uploading…</>
              ) : (
                <><Upload size={15} /> Publish video</>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

function ProgressBar({ label, pct }) {
  return (
    <div className={styles.progressRow}>
      <span className={styles.progressLabel}>{label}</span>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.progressPct}>{pct}%</span>
    </div>
  )
}
