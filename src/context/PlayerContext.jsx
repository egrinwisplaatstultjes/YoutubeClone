import { createContext, useContext, useState, useCallback, useRef } from 'react'

const Ctx = createContext(null)

export function PlayerProvider({ children }) {
  const [video,       setVideoState]  = useState(null)
  const [miniVisible, setMiniVisible] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const elRef       = useRef(null)
  const userPaused  = useRef(false) // true only when user explicitly paused

  // One persistent <video> element for the entire app lifetime
  function getEl() {
    if (!elRef.current) {
      const el = document.createElement('video')
      el.playsInline             = true
      el.disablePictureInPicture = true
      el.style.cssText = 'width:100%;height:100%;display:block;background:#000;object-fit:contain'
      // Track user-initiated pause vs browser-auto-pause
      el.addEventListener('pause', () => { if (!el.seeking) userPaused.current = true  })
      el.addEventListener('play',  () => {                   userPaused.current = false })
      elRef.current = el
    }
    return elRef.current
  }

  // Attach the element into a container div, applying options
  const mountIn = useCallback((container, { controls = false } = {}) => {
    if (!container) return
    const el = getEl()
    el.controls = controls
    container.appendChild(el)
  }, [])

  // Detach from wherever it currently lives (keeps playing in memory)
  const detach = useCallback(() => {
    const el = elRef.current
    if (el && el.parentElement) el.parentElement.removeChild(el)
  }, [])

  const setVideo = useCallback((v) => {
    setVideoState(v)
    const el = getEl()
    if (el.dataset.videoId !== v.id) {
      el.dataset.videoId = v.id
      el.src = v.videoUrl
    }
  }, [])

  const showMini  = useCallback(() => setMiniVisible(true),  [])
  const hideMini  = useCallback(() => setMiniVisible(false), [])
  const dismiss   = useCallback(() => {
    const el = elRef.current
    if (el) { el.pause(); el.src = ''; el.load(); el.dataset.videoId = '' }
    setVideoState(null)
    setMiniVisible(false)
    setCurrentTime(0)
  }, [])

  return (
    <Ctx.Provider value={{
      video, currentTime, miniVisible,
      setVideo, setCurrentTime, showMini, hideMini, dismiss,
      getEl, mountIn, detach, userPaused,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const usePlayer = () => useContext(Ctx)
