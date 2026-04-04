import { supabase } from './supabase'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

/**
 * Broadcaster: start streaming localStream to all viewers.
 * Signaling is done via Supabase Realtime broadcast.
 * Returns { sendChat, cleanup }
 */
export async function startBroadcast(videoId, localStream, { onViewerCount, onChatMessage }) {
  const peers = {} // viewerId → RTCPeerConnection

  const channel = supabase.channel(`live:${videoId}`, {
    config: {
      broadcast: { self: false },
      presence:  { key: `host` },
    },
  })

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      // Count only viewer presences (keys that are not 'host')
      const viewerCount = Object.keys(state).filter(k => k !== 'host').length
      onViewerCount?.(viewerCount)
    })
    .on('broadcast', { event: 'viewer-join' }, async ({ payload }) => {
      const { viewerId } = payload
      // Close any existing peer for this viewerId (handles reconnection)
      if (peers[viewerId]) {
        peers[viewerId].close()
        delete peers[viewerId]
      }

      const pc = new RTCPeerConnection(ICE_SERVERS)
      peers[viewerId] = pc

      localStream.getTracks().forEach(track => pc.addTrack(track, localStream))

      pc.onicecandidate = (e) => {
        if (!e.candidate) return
        channel.send({
          type: 'broadcast',
          event: 'ice',
          payload: { from: 'host', to: viewerId, candidate: e.candidate },
        })
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      channel.send({
        type: 'broadcast',
        event: 'offer',
        payload: { to: viewerId, sdp: pc.localDescription },
      })
    })
    .on('broadcast', { event: 'answer' }, async ({ payload }) => {
      const { from: viewerId, sdp } = payload
      const pc = peers[viewerId]
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp)).catch(() => {})
      }
    })
    .on('broadcast', { event: 'ice' }, async ({ payload }) => {
      const { from, to, candidate } = payload
      if (from === 'viewer' && peers[to]) {
        await peers[to].addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
      }
    })
    .on('broadcast', { event: 'chat' }, ({ payload }) => {
      onChatMessage?.(payload)
    })

  await new Promise((resolve) => {
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ role: 'host' })
        resolve()
      }
    })
  })

  return {
    sendChat: (msg) => channel.send({ type: 'broadcast', event: 'chat', payload: msg }),
    cleanup: () => {
      channel.send({ type: 'broadcast', event: 'stream-ended', payload: {} }).catch(() => {})
      Object.values(peers).forEach(pc => pc.close())
      supabase.removeChannel(channel)
    },
  }
}

/**
 * Viewer: connects to a live broadcast via WebRTC.
 * Returns { sendChat, cleanup }
 */
export async function connectToStream(videoId, viewerId, { onStream, onChatMessage, onViewerCount, onStreamEnd }) {
  const pc = new RTCPeerConnection(ICE_SERVERS)
  // Queue ICE candidates that arrive before setRemoteDescription
  const iceQueue = []
  let remoteSet = false

  const channel = supabase.channel(`live:${videoId}`, {
    config: {
      broadcast: { self: false },
      presence:  { key: viewerId },
    },
  })

  pc.ontrack = (e) => {
    if (e.streams?.[0]) onStream?.(e.streams[0])
  }

  pc.onicecandidate = (e) => {
    if (!e.candidate) return
    channel.send({
      type: 'broadcast',
      event: 'ice',
      payload: { from: 'viewer', to: viewerId, candidate: e.candidate },
    })
  }

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      onViewerCount?.(Object.keys(state).length)
    })
    .on('broadcast', { event: 'offer' }, async ({ payload }) => {
      if (payload.to !== viewerId) return
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
      remoteSet = true
      for (const c of iceQueue) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
      }
      iceQueue.length = 0
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      channel.send({
        type: 'broadcast',
        event: 'answer',
        payload: { from: viewerId, sdp: pc.localDescription },
      })
    })
    .on('broadcast', { event: 'ice' }, async ({ payload }) => {
      if (payload.from !== 'host' || payload.to !== viewerId) return
      if (remoteSet) {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {})
      } else {
        iceQueue.push(payload.candidate)
      }
    })
    .on('broadcast', { event: 'chat' }, ({ payload }) => {
      onChatMessage?.(payload)
    })
    .on('broadcast', { event: 'stream-ended' }, () => {
      onStreamEnd?.()
    })

  await new Promise((resolve) => {
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ role: 'viewer' })
        channel.send({
          type: 'broadcast',
          event: 'viewer-join',
          payload: { viewerId },
        })
        resolve()
      }
    })
  })

  return {
    sendChat: (msg) => channel.send({ type: 'broadcast', event: 'chat', payload: msg }),
    cleanup: () => {
      pc.close()
      supabase.removeChannel(channel)
    },
  }
}
