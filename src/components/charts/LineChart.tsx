import { useState } from 'react'
import { useChartWidth } from './useChartWidth'
import { niceTicks, thinLabels } from './scale'

export interface LinePoint {
  label: string
  value: number
}

interface Props {
  data: LinePoint[]
  height?: number
  /** Tooltip value formatter (e.g. `v => `${v} kg``). */
  formatValue?: (v: number) => string
  /** Y-axis tick formatter (e.g. pace MM:SS). */
  formatTick?: (v: number) => string
}

const M = { top: 10, right: 10, bottom: 22, left: 46 }

// A single-series line chart drawn as plain SVG (D2 — replaces recharts'
// LineChart). Themed via CSS variables, responsive via useChartWidth, with a
// press/hover tooltip that reads the nearest point.
export function LineChart({ data, height = 220, formatValue = String, formatTick = String }: Props) {
  const [ref, width] = useChartWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const values = data.map((d) => d.value)
  const { min, max, ticks } = niceTicks(Math.min(...values), Math.max(...values))
  const span = max - min || 1

  const plotW = Math.max(0, width - M.left - M.right)
  const plotH = Math.max(0, height - M.top - M.bottom)
  const x = (i: number) =>
    data.length === 1 ? M.left + plotW / 2 : M.left + (plotW * i) / (data.length - 1)
  const y = (v: number) => M.top + plotH * (1 - (v - min) / span)

  const maxLabels = Math.max(2, Math.floor(plotW / 56))
  const labelIdx = new Set(thinLabels(data.length, maxLabels))
  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`)
    .join(' ')

  function locate(e: React.PointerEvent<SVGRectElement>) {
    if (data.length === 0 || plotW <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = data.length === 1 ? 0 : (e.clientX - rect.left) / plotW
    const i = Math.round(frac * (data.length - 1))
    setActive(Math.max(0, Math.min(data.length - 1, i)))
  }

  return (
    <div ref={ref} style={{ height }} className="w-full select-none">
      {width > 0 && data.length > 0 && (
        <svg width={width} height={height} role="img" aria-label="line chart">
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={M.left}
                x2={width - M.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <text
                x={M.left - 6}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={11}
                fill="var(--muted-foreground)"
              >
                {formatTick(t)}
              </text>
            </g>
          ))}

          {data.map((d, i) =>
            labelIdx.has(i) ? (
              <text
                key={i}
                x={x(i)}
                y={height - M.bottom + 15}
                textAnchor="middle"
                fontSize={11}
                fill="var(--muted-foreground)"
              >
                {d.label}
              </text>
            ) : null,
          )}

          <path
            d={linePath}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {data.map((d, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(d.value)}
              r={active === i ? 4 : 2.5}
              fill="var(--primary)"
            />
          ))}

          {active != null && data[active] && (
            <>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={M.top}
                y2={height - M.bottom}
                stroke="var(--muted-foreground)"
                strokeWidth={1}
                opacity={0.4}
              />
              <ChartTooltip
                x={x(active)}
                label={data[active].label}
                value={formatValue(data[active].value)}
                left={M.left}
                right={width - M.right}
                top={M.top}
              />
            </>
          )}

          <rect
            x={M.left}
            y={M.top}
            width={plotW}
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

// A two-line tooltip box (category label + formatted value), clamped inside the
// plot so it never clips at the edges. Width is estimated from the text length
// (SVG can't measure before layout).
export function ChartTooltip({
  x,
  label,
  value,
  left,
  right,
  top,
}: {
  x: number
  label: string
  value: string
  left: number
  right: number
  top: number
}) {
  const w = Math.max(46, Math.max(label.length, value.length) * 6.8 + 14)
  const h = 34
  const bx = Math.max(left, Math.min(right - w, x - w / 2))
  return (
    <g pointerEvents="none">
      <rect x={bx} y={top} width={w} height={h} rx={6} fill="var(--popover)" stroke="var(--border)" />
      <text
        x={bx + w / 2}
        y={top + 13}
        textAnchor="middle"
        fontSize={10}
        fill="var(--muted-foreground)"
      >
        {label}
      </text>
      <text
        x={bx + w / 2}
        y={top + 27}
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
        fill="var(--popover-foreground)"
      >
        {value}
      </text>
    </g>
  )
}
