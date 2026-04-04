import { Home, Clapperboard } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { fetchSubscriptions, fetchLiveChannelIds } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import styles from './Sidebar.module.css'

const nav = [
  { icon: Home,         label: 'Home',   path: '/' },
  { icon: Clapperboard, label: 'Shorts', path: '/shorts' },
]

export default function Sidebar({ open }) {
  const location = useLocation()
  const { user } = useAuth()
  const [subs,    setSubs]    = useState([])
  const [liveIds, setLiveIds] = useState(new Set())

  useEffect(() => {
    if (!user) { setSubs([]); return }
    const load = () => {
      fetchSubscriptions().then(setSubs).catch(() => {})
      fetchLiveChannelIds().then(setLiveIds).catch(() => {})
    }
    load()
    window.addEventListener('velora:subs-changed', load)
    return () => window.removeEventListener('velora:subs-changed', load)
  }, [user?.id])

  return (
    <aside className={`${styles.sidebar} ${open ? styles.open : styles.closed}`}>
      <div className={styles.group}>
        {nav.map(({ icon: Icon, label, path }) => (
          <Link key={path} to={path} className={`${styles.item} ${location.pathname === path ? styles.active : ''}`}>
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        ))}
      </div>

      {subs.length > 0 && (
        <>
          <div className={styles.sep} />
          <p className={styles.label}>Subscriptions</p>
          <div className={styles.group}>
            {subs.map(s => (
              <Link
                key={s.channel_id}
                to={`/channel/${s.channel_id}`}
                className={styles.subItem}
              >
                <div className={styles.subImgWrap}>
                  {s.channel_avatar
                    ? <img src={s.channel_avatar} alt={s.channel_name} referrerPolicy="no-referrer" />
                    : <div className={styles.subImgFallback}>{(s.channel_name?.[0] ?? '?').toUpperCase()}</div>
                  }
                  {liveIds.has(s.channel_id) && <span className={styles.liveDot} />}
                </div>
                <span className={styles.subName}>{s.channel_name}</span>
                {liveIds.has(s.channel_id) && (
                  <span className={styles.liveTag}>LIVE</span>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </aside>
  )
}
