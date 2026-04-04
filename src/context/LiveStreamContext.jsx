import { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react'
import { endLiveStream, insertLiveChatMessage, fetchLiveChatMessages } from '../lib/db'

const LiveStreamContext = createContext(null)

const SESSION_KEY = 'velora_live_session'

function readSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) ?? null } catch { return null }
}
function writeSession(data) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)) } catch {}
}
function deleteSession() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
}

export function LiveStreamProvider({ children }) {
  const [isLive,       setIsLive]       = useState(false)
  const [liveTitle,    setLiveTitle]    = useState('')
  const [liveCategory, setLiveCategory] = useState('')
  const [viewerCount,  setViewerCount]  = useState(0)
  const [elapsed,      setElapsed]      = useState(0)
  const [chatMessages, setChatMessages] = useState([])
  const [chatLoading,  setChatLoading]  = useState(false)

  // savedSession: populated when a stream was interrupted (refresh/crash) without endStream
  const [savedSession, setSavedSession] = useState(() => readSession())

  const mediaRef     = useRef(null)
  const broadcastRef = useRef(null)
  const videoIdRef   = useRef(null)
  const timerRef     = useRef(null)
  const startTsRef   = useRef(null)

  // Elapsed timer — runs while live
  useEffect(() => {
    if (!isLive) return
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(timerRef.current)
  }, [isLive])

  // Keep sessionStorage chat in sync while streaming
  useEffect(() => {
    if (!isLive || !videoIdRef.current) return
    writeSession({
      title:    liveTitle,
      category: liveCategory,
      videoId:  videoIdRef.current,
      startTs:  startTsRef.current,
      chat:     chatMessages,
    })
  }, [chatMessages, isLive, liveTitle, liveCategory])

  const startStream = useCallback(async ({
    media, broadcast, videoId, title, category,
    existingChat = [],       // pass when resuming a previous session
    resumeStartTs = null,    // pass to restore elapsed on resume
  }) => {
    mediaRef.current     = media
    broadcastRef.current = broadcast
    videoIdRef.current   = videoId
    const startTs        = resumeStartTs ?? Date.now()
    startTsRef.current   = startTs

    setLiveTitle(title)
    setLiveCategory(category)
    setElapsed(resumeStartTs ? Math.floor((Date.now() - resumeStartTs) / 1000) : 0)
    setViewerCount(0)
    setIsLive(true)

    // Load chat from DB (authoritative), fall back to sessionStorage cache
    let chat = existingChat
    setChatLoading(true)
    try {
      const dbChat = await fetchLiveChatMessages(videoId)
      if (dbChat.length > 0) chat = dbChat
    } catch {}
    setChatLoading(false)
    setChatMessages(chat)

    // Save immediately so a sync refresh won't lose the session
    const session = { title, category, videoId, startTs, chat }
    writeSession(session)
    setSavedSession(session)
  }, [])

  const endStream = useCallback(async () => {
    clearInterval(timerRef.current)
    broadcastRef.current?.cleanup()
    if (videoIdRef.current) await endLiveStream(videoIdRef.current).catch(() => {})
    mediaRef.current?.getTracks().forEach(t => t.stop())
    mediaRef.current     = null
    broadcastRef.current = null
    videoIdRef.current   = null
    startTsRef.current   = null
    deleteSession()
    setSavedSession(null)
    setIsLive(false)
    setElapsed(0)
    setChatMessages([])
    setViewerCount(0)
  }, [])

  // Called when user discards a stale saved session without resuming
  const clearSavedSession = useCallback(() => {
    deleteSession()
    setSavedSession(null)
  }, [])

  const sendChat = useCallback((msg) => {
    broadcastRef.current?.sendChat(msg)
    setChatMessages(prev => [...prev, msg])
    if (videoIdRef.current) insertLiveChatMessage(videoIdRef.current, msg).catch(() => {})
  }, [])

  const onViewerCount = useCallback((count) => setViewerCount(count), [])
  const onChatMessage = useCallback((msg) => {
    setChatMessages(prev => [...prev, msg])
    if (videoIdRef.current) insertLiveChatMessage(videoIdRef.current, msg).catch(() => {})
  }, [])

  return (
    <LiveStreamContext.Provider value={{
      isLive,
      liveTitle,
      liveCategory,
      viewerCount,
      elapsed,
      chatMessages,
      chatLoading,
      savedSession,
      mediaRef,
      broadcastRef,
      startStream,
      endStream,
      clearSavedSession,
      sendChat,
      onViewerCount,
      onChatMessage,
    }}>
      {children}
    </LiveStreamContext.Provider>
  )
}

export function useLiveStream() {
  return useContext(LiveStreamContext)
}
