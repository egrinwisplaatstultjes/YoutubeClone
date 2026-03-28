import { useState, useEffect } from 'react'
import { Home, Compass, TrendingUp, History, PlaySquare, Clock, ThumbsUp } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { fetchSubscriptions } from '../lib/db'
import styles from './Sidebar.module.css'

const mainNav = [
  { icon: Home,       label: 'Home',        path: '/' },
  { icon: Compass,    label: 'Explore',     path: '/explore' },
  { icon: TrendingUp, label: 'Trending',    path: '/trending' },
]

const youNav = [
  { icon: History,    label: 'History',     path: '/history' },
  { icon: PlaySquare, label: 'Your videos', path: '/profile' },
  { icon: Clock,      label: 'Watch later', path: '/later' },
  { icon: ThumbsUp,   label: 'Liked',       path: '/liked' },
]

function Item({ icon: Icon, label, path, location }) {
  const active = location.pathname === path
  return (
    <Link to={path} className={`${styles.item} ${active ? styles.active : ''}`}>
      <Icon size={19} />
      <span>{label}</span>
    </Link>
  )
}

export default function Sidebar({ open }) {
  const location = useLocation()
  const [subs, setSubs] = useState([])

  useEffect(() => {
    fetchSubscriptions().then(setSubs).catch(() => {})
  }, [location.pathname]) // re-fetch when navigating so new subs appear

  return (
    <aside className={`${styles.sidebar} ${open ? styles.open : styles.closed}`}>

      <div className={styles.group}>
        {mainNav.map(n => <Item key={n.path} {...n} location={location} />)}
      </div>

      <div className={styles.sep} />
      <div className={styles.label}>You</div>
      <div className={styles.group}>
        {youNav.map(n => <Item key={n.path} {...n} location={location} />)}
      </div>

      {subs.length > 0 && (
        <>
          <div className={styles.sep} />
          <div className={styles.label}>Subscriptions</div>
          <div className={styles.group}>
            {subs.map(ch => (
              <Link key={ch.channel_id} to={`/channel/${ch.channel_id}`} className={styles.subItem}>
                <div className={styles.subImgWrap}>
                  {ch.channel_avatar
                    ? <img src={ch.channel_avatar} alt={ch.channel_name} />
                    : <div className={styles.subImgFallback}>
                        {ch.channel_name.slice(0, 1).toUpperCase()}
                      </div>
                  }
                </div>
                <span className={styles.subName}>{ch.channel_name}</span>
              </Link>
            ))}
          </div>
        </>
      )}

    </aside>
  )
}
