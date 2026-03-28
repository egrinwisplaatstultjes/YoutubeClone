import { useMemo, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Loader2 } from 'lucide-react'
import { fetchVideos } from '../lib/db'
import VideoCard from '../components/VideoCard'
import styles from './SearchPage.module.css'

export default function SearchPage() {
  const [params]  = useSearchParams()
  const q         = params.get('q') || ''
  const [videos,  setVideos]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchVideos().then(setVideos).finally(() => setLoading(false))
  }, [])

  const results = useMemo(() => {
    if (!q.trim()) return []
    const lower = q.toLowerCase()
    return videos.filter(v =>
      v.title.toLowerCase().includes(lower) ||
      v.channel.toLowerCase().includes(lower) ||
      v.category.toLowerCase().includes(lower)
    )
  }, [q, videos])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <p className={styles.query}>
          {q ? <><span>Results for </span><span className={styles.term}>"{q}"</span></> : 'Search for something'}
        </p>
        {q && !loading && (
          <p className={styles.count}>
            {results.length === 0 ? 'No results found' : `${results.length} result${results.length !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      {loading ? (
        <div className={styles.empty}>
          <Loader2 size={32} className={styles.spinner} />
        </div>
      ) : results.length > 0 ? (
        <div className={styles.list}>
          {results.map(v => (
            <div key={v.id} className={styles.row}>
              <VideoCard video={v} layout="row" />
            </div>
          ))}
        </div>
      ) : q ? (
        <div className={styles.empty}>
          <Search size={40} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>No results for "{q}"</p>
          <p className={styles.emptySub}>Try different keywords or check your spelling.</p>
        </div>
      ) : null}
    </div>
  )
}
