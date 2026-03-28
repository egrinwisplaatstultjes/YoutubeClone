import { useState, useEffect } from 'react'

const cache = {}

export function useThumbColor(src) {
  const [color, setColor] = useState(cache[src] ?? null)

  useEffect(() => {
    if (!src) return
    if (cache[src]) { setColor(cache[src]); return }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width  = 40
        canvas.height = 40
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, 40, 40)
        const data = ctx.getImageData(0, 0, 40, 40).data
        let r = 0, g = 0, b = 0, count = 0
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]; g += data[i + 1]; b += data[i + 2]; count++
        }
        const result = `rgba(${Math.round(r/count)}, ${Math.round(g/count)}, ${Math.round(b/count)}, 0.28)`
        cache[src] = result
        setColor(result)
      } catch {}
    }
    img.src = src
  }, [src])

  return color
}
