import { useState, useRef, useEffect } from 'react'
import { Search, Bell, Menu, Mic, X, MicOff, LogOut, User, Radio } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLiveStream } from '../context/LiveStreamContext'
import { getAvatarUrl } from '../lib/utils'
import AuthModal from './AuthModal'
import VeloraLogo from './VeloraLogo'
import styles from './Topbar.module.css'

export default function Topbar({ onToggleSidebar }) {
  const { user, signOut, showAuthModal, openAuthModal, closeAuthModal } = useAuth()
  const { isLive } = useLiveStream()
  const [query,             setQuery]             = useState('')
  const [focused,           setFocused]           = useState(false)
  const [listening,         setListening]         = useState(false)
  const [showMenu,          setShowMenu]          = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [searchOpen,        setSearchOpen]        = useState(false)
  const navigate           = useNavigate()
  const recognitionRef     = useRef(null)
  const menuRef            = useRef(null)
  const notifRef           = useRef(null)
  const searchInputRef     = useRef(null)
  const SR                 = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

  // Close user menu when clicking outside
  useEffect(() => {
    if (!showMenu) return
    function onOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [showMenu])

  // Close notifications when clicking outside
  useEffect(() => {
    if (!showNotifications) return
    function onOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [showNotifications])

  function openSearch() {
    setSearchOpen(true)
    // Let the DOM render before focusing
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  function closeSearch() {
    setSearchOpen(false)
    setQuery('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
      setSearchOpen(false)
    }
  }

  function handleVoice() {
    if (!SR) return

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

  const avatarUrl   = getAvatarUrl(user)
  const displayName = user?.user_metadata?.full_name || user?.email || ''

  return (
    <>
      <header className={styles.bar}>
        {/* Left — logo + burger (hidden when mobile search is open) */}
        <div className={`${styles.left} ${searchOpen ? styles.hiddenOnMobile : ''}`}>
          <button className={styles.icon} onClick={onToggleSidebar} aria-label="Menu">
            <Menu size={20} />
          </button>
          <Link to="/" className={styles.logo}>
            <VeloraLogo size={30} />
            <span className={styles.logoText}>Velora</span>
          </Link>
        </div>

        {/* Search bar — normal on desktop, overlay on mobile when open */}
        <form
          className={`${styles.search} ${focused ? styles.searchFocused : ''} ${searchOpen ? styles.searchMobileOpen : ''}`}
          onSubmit={handleSubmit}
        >
          {/* Back arrow — mobile only, closes the overlay */}
          <button
            type="button"
            className={styles.searchBack}
            onClick={closeSearch}
            aria-label="Close search"
          >
            <X size={18} />
          </button>

          <div className={styles.searchInner}>
            <input
              ref={searchInputRef}
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
          {SR && (
            <button
              type="button"
              className={`${styles.micBtn} ${listening ? styles.micActive : ''}`}
              onClick={handleVoice}
              aria-label="Voice search"
              title={listening ? 'Stop listening' : 'Search by voice'}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}
        </form>

        {/* Right icons — hidden when mobile search is open */}
        <div className={`${styles.right} ${searchOpen ? styles.hiddenOnMobile : ''}`}>
          {/* Search icon button — only visible on mobile */}
          <button className={styles.searchToggle} onClick={openSearch} aria-label="Search">
            <Search size={20} />
          </button>

          {user && (
            <>
              <div className={`${styles.notifWrap} ${styles.hideOnSmall}`} ref={notifRef}>
                <button
                  className={`${styles.icon} ${showNotifications ? styles.iconActive : ''}`}
                  title="Notifications"
                  onClick={() => setShowNotifications(n => !n)}
                >
                  <Bell size={18} />
                </button>
                {showNotifications && (
                  <div className={styles.notifPanel}>
                    <div className={styles.notifHeader}>Notifications</div>
                    <div className={styles.notifEmpty}>
                      <Bell size={28} className={styles.notifEmptyIcon} />
                      <p>No new notifications</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Avatar / Sign-in — always visible, never hidden */}
        <div className={styles.avatarArea}>
          {user ? (
            <div className={styles.avatarWrap} ref={menuRef}>
              <button className={styles.avatarBtn} onClick={() => setShowMenu(m => !m)} title={displayName}>
                <img src={avatarUrl} alt={displayName} className={styles.avatarImg} referrerPolicy="no-referrer" />
              </button>

              {showMenu && (
                <div className={styles.menu}>
                  <div className={styles.menuUser}>
                    <img src={avatarUrl} alt={displayName} className={styles.menuAvatar} referrerPolicy="no-referrer" />
                    <div className={styles.menuUserInfo}>
                      <p className={styles.menuName}>{displayName}</p>
                      <p className={styles.menuEmail}>{user.email}</p>
                    </div>
                  </div>
                  <div className={styles.menuDivider} />
                  <button className={styles.menuItem} onClick={() => { setShowMenu(false); navigate(isLive ? '/go-live' : '/studio') }}>
                    <Radio size={15} /> Creator Studio
                  </button>
                  <button className={styles.menuItem} onClick={() => { setShowMenu(false); navigate('/profile') }}>
                    <User size={15} /> Your channel
                  </button>
                  <div className={styles.menuDivider} />
                  <button className={styles.menuItem} onClick={handleSignOut}>
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className={styles.signInBtn} onClick={openAuthModal}>
              Sign in
            </button>
          )}
        </div>
      </header>

      {showAuthModal && <AuthModal onClose={closeAuthModal} />}
    </>
  )
}
