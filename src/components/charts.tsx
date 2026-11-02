import { useState } from "react"
import { fmtK } from "../lib/format"
import type { Point } from "../lib/stats"

const niceMax = (v: number) => {
  if (v <= 0) return 3000
  const raw = v / 3
  const pow = 10 ** Math.floor(Math.log10(raw))
  const n = raw / pow
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow * 3
}

export function TrendChart({ points, money }: { points: Point[]; money: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null)
  const n = points.length
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)))
  const W = 606, X0 = 10, X1 = 596
  const x = (i: number) => (n === 1 ? (X0 + X1) / 2 : X0 + (i * (X1 - X0)) / (n - 1))
  const y = (v: number) => 155 - (v / max) * 148
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ")
  const peak = points.reduce((b, p, i) => (p.value > points[b].value ? i : b), 0)
  const active = hover ?? (points.some((p) => p.value > 0) ? peak : null)
  const ticks = [max, (max * 2) / 3, max / 3, 0]
  const labelIdx = n <= 6 ? points.map((_, i) => i) : Array.from({ length: 6 }, (_, i) => Math.round((i * (n - 1)) / 5))
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - X0) / (X1 - X0)) * (n - 1)))))
  }
  const ap = active !== null ? points[active] : null
  const left = active !== null ? (x(active) / W) * 100 : 0
  const top = active !== null ? (y(points[active].value) / 160) * 100 : 0

  return (
    <div className="chart-shell">
      <div className="y-labels">{ticks.map((t, i) => <span key={i}>{fmtK(t)}</span>)}</div>
      <div className="trend-plot">
        <div className="grid-line a" /><div className="grid-line b" /><div className="grid-line c" /><div className="grid-line d" />
        <svg viewBox={`0 0 ${W} 160`} preserveAspectRatio="none" role="img" aria-label="Spending trend">
          <defs>
            <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#16A34A" stopOpacity=".18" />
              <stop offset="100%" stopColor="#16A34A" stopOpacity=".01" />
            </linearGradient>
          </defs>
          {n > 0 && <polygon points={`${x(0)},155 ${line} ${x(n - 1)},155`} fill="url(#area)" />}
          <polyline points={line} fill="none" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="trend-overlay" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {ap && (
            <>
              <i className="trend-dot" style={{ left: `${left}%`, top: `${top}%` }} />
              <div className="chart-tooltip" style={{ left: `${Math.max(9, Math.min(91, left))}%`, top: `calc(${top}% - 52px)`, transform: "translateX(-50%)" }}>
                <span>{ap.tip}</span>
                <strong>{money(ap.value)}</strong>
              </div>
            </>
          )}
        </div>
        <div className="x-labels">{labelIdx.map((i) => <span key={i}>{points[i].label}</span>)}</div>
      </div>
    </div>
  )
}

export function Donut({ items, money }: { items: { name: string; color: string; amount: number }[]; money: (n: number) => string }) {
  const total = items.reduce((s, i) => s + i.amount, 0)
  const sorted = items.filter((i) => i.amount > 0).sort((a, b) => b.amount - a.amount)
  const top = sorted.slice(0, 5)
  const rest = sorted.slice(5).reduce((s, i) => s + i.amount, 0)
  const rows = rest > 0 ? [...top, { name: "Other", color: "#cbd5e1", amount: rest }] : top
  let acc = 0
  const stops = rows.map((r) => {
    const from = (acc / total) * 100
    acc += r.amount
    return `${r.color} ${from}% ${(acc / total) * 100}%`
  })
  return (
    <div className="breakdown-wrap">
      <div className="donut" aria-label="Expense breakdown chart" style={{ background: total ? `conic-gradient(${stops.join(", ")})` : "#e5eaf1" }}>
        <div>
          <strong>{money(total)}</strong>
          <span>Total spent</span>
        </div>
      </div>
      <div className="legend-list">
        {rows.length === 0 && <div className="legend-row"><span style={{ gridColumn: "1 / -1" }}>No spending in this period yet.</span></div>}
        {rows.map((r) => (
          <div className="legend-row" key={r.name}>
            <i style={{ background: r.color }} />
            <span>{r.name}</span>
            <strong>{money(r.amount)}</strong>
            <small>{Math.round((r.amount / total) * 100)}%</small>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BarChart({ items }: { items: { label: string; value: number; current?: boolean; tip: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="bar-chart">
      {items.map((b, i) => (
        <div key={i} title={b.tip}>
          <span style={{ height: `${Math.max(b.value ? 3 : 1, (b.value / max) * 82)}%` }} className={b.current ? "current" : ""}>
            <i>{b.value ? fmtK(b.value) : ""}</i>
          </span>
          <small>{b.label}</small>
        </div>
      ))}
    </div>
  )
}
