import { useState, useEffect } from 'react'
import { supabase } from './supabase'

/**
 * Subscribes to the presence channel for a live stream and returns
 * the current viewer count. Pass null when the video is not live.
 */
export function useLiveViewerCount(videoId) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!videoId) { setCount(0); return }

    const channel = supabase.channel(`live:${videoId}`, {
      config: { presence: { key: `card-observer-${Math.random()}` } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        // Subtract 1 for ourselves; floor at 0
        const viewers = Math.max(0, Object.keys(state).filter(k => !k.startsWith('card-observer')).length)
        setCount(viewers)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track presence so the sync event fires
          await channel.track({ role: 'card-observer' })
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [videoId])

  return count
}
