import { useEffect, useRef, useState } from 'react'

// Measure a container's width so an SVG chart can render at real pixel
// dimensions (crisp text + strokes, correct aspect) rather than being scaled by
// a viewBox. Replaces recharts' ResponsiveContainer (D2).
export function useChartWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = (w: number) => setWidth((prev) => (Math.round(w) !== prev ? Math.round(w) : prev))
    const ro = new ResizeObserver((entries) => measure(entries[0]?.contentRect.width ?? 0))
    ro.observe(el)
    measure(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}
