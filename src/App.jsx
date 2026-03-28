import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Topbar from './components/Topbar'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import WatchPage from './pages/WatchPage'
import ProfilePage from './pages/ProfilePage'
import SearchPage from './pages/SearchPage'
import UploadPage from './pages/UploadPage'
import ChannelPage from './pages/ChannelPage'
import EditVideoPage from './pages/EditVideoPage'
import MiniPlayer from './components/MiniPlayer'
import { PlayerProvider } from './context/PlayerContext'
import { AuthProvider } from './context/AuthContext'
import styles from './App.module.css'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <AuthProvider>
    <PlayerProvider>
      <div className={styles.app}>
        <ScrollToTop />
        <Topbar onToggleSidebar={() => setSidebarOpen(o => !o)} />
        <Sidebar open={sidebarOpen} />
        <main className={`${styles.main} ${sidebarOpen ? styles.shifted : ''}`}>
          <Routes>
            <Route path="/"          element={<Home />} />
            <Route path="/watch/:id" element={<WatchPage />} />
            <Route path="/profile"   element={<ProfilePage />} />
            <Route path="/search"    element={<SearchPage />} />
            <Route path="/upload"         element={<UploadPage />} />
            <Route path="/edit/:id"       element={<EditVideoPage />} />
            <Route path="/channel/:channelId" element={<ChannelPage />} />
            <Route path="*"          element={<Home />} />
          </Routes>
        </main>
        <MiniPlayer />
      </div>
    </PlayerProvider>
    </AuthProvider>
  )
}
