import { useState, useRef, useEffect } from 'react'
import { Search, Bell, Video, Menu, Mic, X, Radio, MicOff, LogOut, User } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthModal from './AuthModal'
import styles from './Topbar.module.css'

export default function Topbar({ onToggleSidebar }) {
  const { user, signOut } = useAuth()
  const [query,      setQuery]      = useState('')
  const [focused,    setFocused]    = useState(false)
  const [listening,  setListening]  = useState(false)
  const [showAuth,   setShowAuth]   = useState(false)
  const [showMenu,   setShowMenu]   = useState(false)
  const navigate       = useNavigate()
  const recognitionRef = useRef(null)
  const menuRef        = useRef(null)

  // Close user menu when clicking outside
  useEffect(() => {
    if (!showMenu) return
    function onOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [showMenu])

  function handleSubmit(e) {
    e.preventDefault()
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  function handleVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Voice search is not supported in this browser.'); return }

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = false
    recognitionRef.current = rec

    rec.onstart  = () => setListening(true)
    rec.onend    = () => setListening(false)
    rec.onerror  = () => setListening(false)
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      setQuery(transcript)
      navigate(`/search?q=${encodeURIComponent(transcript)}`)
    }
    rec.start()
  }

  async function handleSignOut() {
    setShowMenu(false)
    await signOut()
  }

  // Derive avatar URL and display name from auth user
  const avatarUrl    = user?.user_metadata?.avatar_url
  const displayName  = user?.user_metadata?.full_name || user?.email || ''
  const initials     = displayName
    ? displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <>
      <header className={styles.bar}>
        <div className={styles.left}>
          <button className={styles.icon} onClick={onToggleSidebar} aria-label="Menu">
            <Menu size={20} />
          </button>
          <Link to="/" className={styles.logo}>
            <Radio size={18} className={styles.logoIcon} />
            <span>Wavr</span>
          </Link>
        </div>

        <form className={`${styles.search} ${focused ? styles.searchFocused : ''}`} onSubmit={handleSubmit}>
          <div className={styles.searchInner}>
            <input
              className={styles.input}
              placeholder="Search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
            {query && (
              <button type="button" className={styles.clear} onClick={() => setQuery('')}>
                <X size={13} />
              </button>
            )}
          </div>
          <button type="submit" className={styles.searchBtn} aria-label="Search">
            <Search size={16} />
          </button>
          <button
            type="button"
            className={`${styles.micBtn} ${listening ? styles.micActive : ''}`}
            onClick={handleVoice}
            aria-label="Voice search"
            title={listening ? 'Stop listening' : 'Search by voice'}
          >
            {listening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        </form>

        <div className={styles.right}>
          {user && (
            <button className={styles.icon} title="Upload video" onClick={() => navigate('/upload')}>
              <Video size={18} />
            </button>
          )}
          <button className={styles.icon} title="Notifications">
            <Bell size={18} />
            <span className={styles.dot} />
          </button>

          {user ? (
            <div className={styles.avatarWrap} ref={menuRef}>
              <button className={styles.avatarBtn} onClick={() => setShowMenu(m => !m)} title={displayName}>
                {avatarUrl
                  ? <img src={avatarUrl} alt={displayName} className={styles.avatarImg} referrerPolicy="no-referrer" />
                  : <span className={styles.avatarInitials}>{initials}</span>
                }
              </button>

              {showMenu && (
                <div className={styles.menu}>
                  <div className={styles.menuUser}>
                    {avatarUrl
                      ? <img src={avatarUrl} alt={displayName} className={styles.menuAvatar} referrerPolicy="no-referrer" />
                      : <span className={styles.menuInitials}>{initials}</span>
                    }
                    <div className={styles.menuUserInfo}>
                      <p className={styles.menuName}>{displayName}</p>
                      <p className={styles.menuEmail}>{user.email}</p>
                    </div>
                  </div>
                  <div className={styles.menuDivider} />
                  <button className={styles.menuItem} onClick={() => { setShowMenu(false); navigate('/profile') }}>
                    <User size={15} /> Your channel
                  </button>
                  <button className={styles.menuItem} onClick={handleSignOut}>
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className={styles.signInBtn} onClick={() => setShowAuth(true)}>
              Sign in
            </button>
          )}
        </div>
      </header>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  )
}
