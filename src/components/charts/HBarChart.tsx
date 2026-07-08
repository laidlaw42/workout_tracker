import { useState } from 'react'
import { useChartWidth } from './useChartWidth'
import { intTicks } from './scale'
import { ChartTooltip } from './LineChart'

export interface BarRow {
  label: string
  value: number
  /** Bar fill (a CSS colour or var). */
  color: string
  /** Draw a gold outline (onsight/flash sends). */
  outlined?: boolean
}

interface Props {
  data: BarRow[]
  height?: number
  /** Tooltip value formatter; defaults to the raw count. */
  formatValue?: (v: number) => string
}

const M = { top: 8, right: 12, bottom: 22, left: 44 }
const GOLD = '#f59e0b'

// A horizontal bar chart (D2 — replaces recharts' vertical-layout BarChart),
// used for the climbing grade pyramid. One band per row, bars baselined at zero,
// per-row colour, optional gold outline, tap-for-count tooltip.
export function HBarChart({ data, height = 220, formatValue = String }: Props) {
  const [ref, width] = useChartWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const dataMax = Math.max(1, ...data.map((d) => d.value))
  const { max, ticks } = intTicks(dataMax)
  const plotW = Math.max(0, width - M.left - M.right)
  const plotH = Math.max(0, height - M.top - M.bottom)
  const n = data.length
  const bandH = n > 0 ? plotH / n : 0
  const barH = Math.min(30, bandH * 0.62)
  const xv = (v: number) => M.left + plotW * (v / (max || 1))
  const cy = (i: number) => M.top + bandH * i + bandH / 2

  // A bar with only its right corners rounded (matches the old radius=[0,4,4,0]).
  const barPath = (len: number, top: number) => {
    const r = Math.min(4, barH / 2, Math.max(0, len))
    const w = Math.max(0, len)
    if (w <= r) return `M${M.left},${top} h${w} v${barH} h${-w} z`
    return `M${M.left},${top} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${barH - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(w - r)} z`
  }

  function locate(e: React.PointerEvent<SVGRectElement>) {
    if (n === 0 || plotH <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.floor((e.clientY - rect.top) / bandH)
    setActive(Math.max(0, Math.min(n - 1, i)))
  }

  return (
    <div ref={ref} style={{ height }} className="w-full select-none">
      {width > 0 && n > 0 && (
        <svg width={width} height={height} role="img" aria-label="bar chart">
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={xv(t)}
                x2={xv(t)}
                y1={M.top}
                y2={height - M.bottom}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <text
                x={xv(t)}
                y={height - M.bottom + 15}
                textAnchor="middle"
                fontSize={11}
                fill="var(--muted-foreground)"
              >
                {t}
              </text>
            </g>
          ))}

          {data.map((d, i) => (
            <g key={i}>
              <text
                x={M.left - 6}
                y={cy(i)}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={11}
                fill="var(--muted-foreground)"
              >
                {d.label}
              </text>
              <path
                d={barPath(xv(d.value) - M.left, cy(i) - barH / 2)}
                fill={d.color}
                stroke={d.outlined ? GOLD : undefined}
                strokeWidth={d.outlined ? 2 : 0}
                opacity={active == null || active === i ? 1 : 0.5}
              />
            </g>
          ))}

          {active != null && data[active] && (
            <ChartTooltip
              x={Math.max(M.left, xv(data[active].value))}
              label={data[active].label}
              value={formatValue(data[active].value)}
              left={M.left}
              right={width - M.right}
              top={M.top}
            />
          )}

          <rect
            x={0}
            y={M.top}
            width={width}
            height={plotH}
            fill="transparent"
            style={{ touchAction: 'pan-y' }}
            onPointerDown={locate}
            onPointerMove={locate}
            onPointerLeave={() => setActive(null)}
            onPointerUp={() => setActive(null)}
            onPointerCancel={() => setActive(null)}
          />
        </svg>
      )}
    </div>
  )
}
