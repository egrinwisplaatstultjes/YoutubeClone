import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, Loader2, CheckCircle2 } from 'lucide-react'
import { fetchVideo, updateVideo } from '../lib/db'
import { categories } from '../data/mockData'
import RichEditor from '../components/RichEditor'
import styles from './UploadPage.module.css'

const MOOD_TAGS = ['chill', 'focused', 'curious', 'energized', 'hype']

export default function EditVideoPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading,  setLoading]  = useState(true)
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [category,    setCategory]    = useState('Tech')
  const [tags,        setTags]        = useState([])
  const [status,   setStatus]   = useState('idle') // idle | saving | done
  const [error,    setError]    = useState('')

  useEffect(() => {
    fetchVideo(id).then(v => {
      setTitle(v.title)
      setDescription(v.description || '')
      setCategory(v.category || 'Tech')
      setTags(v.tags || [])
      setLoading(false)
    }).catch(() => { setError('Video not found.'); setLoading(false) })
  }, [id])

  function toggleTag(tag) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }
    setError('')
    setStatus('saving')
    try {
      await updateVideo(id, { title: title.trim(), description: description.trim(), category, tags })
      setStatus('done')
      setTimeout(() => navigate(`/watch/${id}`), 1000)
    } catch (err) {
      setError(err.message || 'Failed to save changes.')
      setStatus('idle')
    }
  }

  const saving = status === 'saving'
  const done   = status === 'done'

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', color: 'var(--text-3)' }}>
            <Loader2 size={32} style={{ animation: 'spin 0.8s linear infinite' }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.heading}>Edit video</h1>

        <form className={styles.form} onSubmit={handleSubmit}>
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

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => navigate(-1)}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={saving || done}
            >
              {done ? (
                <><CheckCircle2 size={15} /> Saved!</>
              ) : saving ? (
                <><Loader2 size={15} className={styles.spin} /> Saving…</>
              ) : (
                <><Save size={15} /> Save changes</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
