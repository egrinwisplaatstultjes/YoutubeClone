import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera, ArrowLeft, Loader2, Check, User, Bell,
  Lock, Mail, Calendar, ShieldCheck, AtSign,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getAvatarUrl } from '../lib/utils'
import { uploadFile } from '../lib/db'
import styles from './SettingsPage.module.css'

const SECTIONS = [
  { id: 'profile',       label: 'Profile',       icon: User },
  { id: 'account',       label: 'Account',        icon: Lock },
  { id: 'notifications', label: 'Notifications',  icon: Bell },
]

const DEFAULT_NOTIFS = {
  newSubscriber:   true,
  videoComments:   true,
  replies:         true,
  recommendations: true,
  digest:          false,
}

export default function SettingsPage() {
  const { user, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [section, setSection] = useState('profile')

  // Profile state
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const bio         = user?.user_metadata?.bio || ''
  const avatarUrl   = getAvatarUrl(user)
  const bannerUrl   = user?.user_metadata?.banner_url || ''

  const [name,       setName]       = useState(displayName)
  const [bioText,    setBioText]    = useState(bio)
  const [avatarSrc,  setAvatarSrc]  = useState(avatarUrl)
  const [bannerSrc,  setBannerSrc]  = useState(bannerUrl)
  const [avatarFile, setAvatarFile] = useState(null)
  const [bannerFile, setBannerFile] = useState(null)

  // Notifications state
  const savedNotifs = user?.user_metadata?.notifications || {}
  const [notifs, setNotifs] = useState({ ...DEFAULT_NOTIFS, ...savedNotifs })

  // Save state
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState(null)

  const avatarInput = useRef(null)
  const bannerInput = useRef(null)

  useEffect(() => {
    if (!user) navigate('/profile')
  }, [user])

  if (!user) return null

  const handle     = '@' + (user.email?.split('@')[0] ?? 'you').toLowerCase().replace(/[^a-z0-9]/g, '')
  const joinedDate = new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const provider   = user.app_metadata?.provider || 'email'
  const defaultBanner = `https://picsum.photos/seed/${user.id}/1600/280`

  function pickAvatar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarSrc(URL.createObjectURL(file))
  }

  function pickBanner(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBannerFile(file)
    setBannerSrc(URL.createObjectURL(file))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const updates = {
        full_name: name.trim() || displayName,
        bio: bioText.trim(),
        notifications: notifs,
      }
      if (avatarFile) updates.avatar_url = await uploadFile(`avatars/${user.id}`, avatarFile)
      if (bannerFile) updates.banner_url = await uploadFile(`banners/${user.id}`, bannerFile)
      await updateProfile(updates)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function toggleNotif(key) {
    setNotifs(n => ({ ...n, [key]: !n[key] }))
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>

        {/* Top header */}
        <div className={styles.topHeader}>
          <button className={styles.backBtn} onClick={() => navigate('/profile')}>
            <ArrowLeft size={18} />
          </button>
          <h1 className={styles.pageTitle}>Settings</h1>
        </div>

        <div className={styles.layout}>
          {/* Sidebar */}
          <nav className={styles.sidebar}>
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`${styles.navItem} ${section === id ? styles.navItemActive : ''}`}
                onClick={() => setSection(id)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className={styles.content}>

            {/* ── Profile ── */}
            {section === 'profile' && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Profile</h2>
                <p className={styles.sectionSub}>This is how you appear on Velora.</p>

                {/* Banner */}
                <div className={styles.bannerWrap}>
                  <img
                    src={bannerSrc || defaultBanner}
                    alt="Channel banner"
                    className={styles.bannerImg}
                  />
                  <button
                    className={styles.bannerEditBtn}
                    onClick={() => bannerInput.current?.click()}
                    title="Change banner"
                  >
                    <Camera size={13} /> Change banner
                  </button>
                  <input ref={bannerInput} type="file" accept="image/*" className={styles.hidden} onChange={pickBanner} />
                </div>

                {/* Avatar */}
                <div className={styles.avatarRow}>
                  <div className={styles.avatarWrap}>
                    <img src={avatarSrc} alt={name} className={styles.avatar} referrerPolicy="no-referrer" />
                    <button
                      className={styles.avatarEditBtn}
                      onClick={() => avatarInput.current?.click()}
                      title="Change photo"
                    >
                      <Camera size={12} />
                    </button>
                    <input ref={avatarInput} type="file" accept="image/*" className={styles.hidden} onChange={pickAvatar} />
                  </div>
                  <div>
                    <p className={styles.avatarName}>{name || displayName}</p>
                    <p className={styles.avatarHint}>Click the camera to update your photo</p>
                  </div>
                </div>

                <div className={styles.divider} />

                {/* Fields */}
                <div className={styles.fields}>
                  <div className={styles.field}>
                    <label className={styles.label}>Display name</label>
                    <input
                      className={styles.input}
                      value={name}
                      onChange={e => setName(e.target.value)}
                      maxLength={60}
                      placeholder="Your name"
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Handle</label>
                    <div className={styles.inputReadonly}>
                      <AtSign size={14} className={styles.inputIcon} />
                      <span>{handle.slice(1)}</span>
                    </div>
                    <p className={styles.fieldHint}>Your handle is based on your email and cannot be changed.</p>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Bio</label>
                    <textarea
                      className={styles.textarea}
                      value={bioText}
                      onChange={e => setBioText(e.target.value)}
                      maxLength={300}
                      rows={3}
                      placeholder="Tell viewers about your channel"
                    />
                    <p className={styles.charCount}>{bioText.length}/300</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Account ── */}
            {section === 'account' && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Account</h2>
                <p className={styles.sectionSub}>Your account details and sign-in information.</p>

                <div className={styles.fields}>
                  <div className={styles.field}>
                    <label className={styles.label}>Email</label>
                    <div className={styles.inputReadonly}>
                      <Mail size={14} className={styles.inputIcon} />
                      <span>{user.email}</span>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Sign-in method</label>
                    <div className={styles.providerBadge}>
                      <ShieldCheck size={14} />
                      <span>
                        {provider === 'google' ? 'Google' : provider === 'github' ? 'GitHub' : 'Email & password'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Member since</label>
                    <div className={styles.inputReadonly}>
                      <Calendar size={14} className={styles.inputIcon} />
                      <span>{joinedDate}</span>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>User ID</label>
                    <div className={styles.inputReadonly} style={{ fontFamily: 'monospace', fontSize: 12 }}>
                      <span style={{ opacity: 0.7 }}>{user.id}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Notifications ── */}
            {section === 'notifications' && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Notifications</h2>
                <p className={styles.sectionSub}>Choose what you want to be notified about.</p>

                <div className={styles.toggleList}>
                  <ToggleRow
                    label="New subscribers"
                    sub="When someone subscribes to your channel"
                    checked={notifs.newSubscriber}
                    onChange={() => toggleNotif('newSubscriber')}
                  />
                  <ToggleRow
                    label="Comments on your videos"
                    sub="When someone leaves a comment on your uploads"
                    checked={notifs.videoComments}
                    onChange={() => toggleNotif('videoComments')}
                  />
                  <ToggleRow
                    label="Replies to your comments"
                    sub="When someone replies to your comments"
                    checked={notifs.replies}
                    onChange={() => toggleNotif('replies')}
                  />
                  <ToggleRow
                    label="Recommendations"
                    sub="Personalized video suggestions from Nova"
                    checked={notifs.recommendations}
                    onChange={() => toggleNotif('recommendations')}
                  />
                  <ToggleRow
                    label="Weekly digest"
                    sub="A summary of what happened on Velora this week"
                    checked={notifs.digest}
                    onChange={() => toggleNotif('digest')}
                  />
                </div>
              </div>
            )}

            {error && <p className={styles.errorMsg}>{error}</p>}

            <div className={styles.footer}>
              <button className={styles.cancelBtn} onClick={() => navigate('/profile')} disabled={saving}>
                Cancel
              </button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving
                  ? <><Loader2 size={14} className={styles.spin} /> Saving…</>
                  : saved
                  ? <><Check size={14} /> Saved</>
                  : 'Save changes'
                }
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function ToggleRow({ label, sub, checked, onChange }) {
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleText}>
        <p className={styles.toggleLabel}>{label}</p>
        <p className={styles.toggleSub}>{sub}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
        onClick={onChange}
      >
        <span className={styles.toggleThumb} />
      </button>
    </div>
  )
}
