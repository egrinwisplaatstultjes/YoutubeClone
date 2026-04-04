import { useState, useEffect, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Topbar from './components/Topbar'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import WatchPage from './pages/WatchPage'
import ProfilePage from './pages/ProfilePage'
import SearchPage from './pages/SearchPage'
import UploadPage from './pages/UploadPage'
import ChannelPage from './pages/ChannelPage'
import EditVideoPage from './pages/EditVideoPage'
import SettingsPage from './pages/SettingsPage'
import GoLivePage from './pages/GoLivePage'
import ShortsPage from './pages/ShortsPage'
import StudioPage from './pages/StudioPage'
import { PlayerProvider } from './context/PlayerContext'
import { AuthProvider } from './context/AuthContext'
import { LiveStreamProvider } from './context/LiveStreamContext'
import styles from './App.module.css'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function AppShell() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // tracks whether the user explicitly closed the sidebar (vs auto-closed)
  const userClosedRef = useRef(false)

  // On mount, open sidebar only if the viewport is wide enough
  useEffect(() => {
    if (window.innerWidth > 800) setSidebarOpen(true)
  }, [])

  useEffect(() => {
    const isWatch = pathname.startsWith('/watch/')
    const isHome  = pathname === '/'
    const isMobile = window.innerWidth <= 600

    if (isWatch || isMobile) {
      setSidebarOpen(false)
    } else if (isHome && !userClosedRef.current) {
      setSidebarOpen(true)
    }
  }, [pathname])

  function handleToggleSidebar() {
    setSidebarOpen(open => {
      const next = !open
      userClosedRef.current = !next
      return next
    })
  }

  function handleOverlayClick() {
    setSidebarOpen(false)
    userClosedRef.current = true
  }

  return (
    <div className={styles.app}>
      <ScrollToTop />
      <Topbar onToggleSidebar={handleToggleSidebar} />
      <Sidebar open={sidebarOpen} />
      {/* Tap-to-close backdrop — only rendered on mobile when sidebar is open */}
      {sidebarOpen && (
        <div className={styles.sidebarOverlay} onClick={handleOverlayClick} aria-hidden />
      )}
      <main className={`${styles.main} ${sidebarOpen ? styles.shifted : ''}`}>
        <Routes>
          <Route path="/"          element={<Home />} />
          <Route path="/watch/:id" element={<WatchPage />} />
          <Route path="/profile"   element={<ProfilePage />} />
          <Route path="/search"    element={<SearchPage />} />
          <Route path="/studio"           element={<StudioPage />} />
          <Route path="/upload"         element={<UploadPage />} />
          <Route path="/edit/:id"       element={<EditVideoPage />} />
          <Route path="/settings"      element={<SettingsPage />} />
          <Route path="/channel/:channelId" element={<ChannelPage />} />
          <Route path="/go-live"            element={<GoLivePage />} />
          <Route path="/shorts"             element={<ShortsPage />} />
          <Route path="/shorts/:id"        element={<ShortsPage />} />
          <Route path="*"          element={<Home />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <LiveStreamProvider>
          <AppShell />
        </LiveStreamProvider>
      </PlayerProvider>
    </AuthProvider>
  )
}
