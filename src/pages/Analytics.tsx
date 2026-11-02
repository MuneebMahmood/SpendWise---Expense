import { useMemo, useState } from "react"
import { ArrowDownRight, ArrowUpRight, Download } from "lucide-react"
import { useApp } from "../ctx"
import { BarChart, Donut, TrendChart } from "../components/charts"
import { Button, CatIcon, Popover, SectionHeader, Segmented, tint } from "../components/ui"
import { computeStats, dailySeries, monthsSeries, weeklySeries } from "../lib/stats"
import { download, fmtDate, fmtTime, monthLabel, monthName, toCSV } from "../lib/format"

export default function Analytics() {
  const { db, money, period, months, setPeriod, toast } = useApp()
  const [view, setView] = useState<"Daily" | "Weekly" | "Monthly">("Weekly")
  const s = useMemo(() => computeStats(db, period), [db, period])
  const points = view === "Daily" ? dailySeries(db.expenses, period, s.days)
    : view === "Weekly" ? weeklySeries(db.expenses, period) : monthsSeries(db.expenses, period, 12)
  const six = monthsSeries(db.expenses, period, 6).map((p, i, a) => ({ ...p, current: i === a.length - 1 }))
  const top = s.byCategory.filter((r) => r.amount > 0).slice(0, 5)
  const topMax = top[0]?.amount || 1
  const ch = s.change
  const perDay = s.month.length / s.elapsed

  const exportReport = () => {
    const rows: unknown[][] = [
      ["SpendWise report", monthLabel(period)], [],
      ["Total spending", s.total], ["Daily average", Math.round(s.dailyAvg)], ["Transactions", s.month.length],
      ["Projected total", Math.round(s.projected)], ["Monthly budget", s.budget], [],
      ["Category", "Transactions", "Amount", "Share %", "Budget"],
      ...s.byCategory.map((r) => [r.cat.name, r.count, r.amount, s.total ? Math.round((r.amount / s.total) * 100) : 0, r.cat.budget ?? ""]), [],
      ["Date", "Time", "Title", "Merchant", "Category", "Payment method", "Amount"],
      ...[...s.month].sort((a, b) => a.date.localeCompare(b.date)).map((e) => [fmtDate(e.date), fmtTime(e.time), e.title, e.merchant, e.category, e.payment, e.amount]),
    ]
    download(`spendwise-report-${period}.csv`, toCSV(rows))
    toast("Report exported", { sub: `${monthLabel(period)} saved as CSV.` })
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div><h1>Analytics & reports</h1><p>Understand where your money goes and spot meaningful trends.</p></div>
        <div>
          <Popover trigger={({ toggle }) => <button className="period-select" onClick={toggle}>{monthLabel(period)} ▾</button>}>
            {(close) => months.map((m) => (
              <button key={m} className={`menu-item ${m === period ? "active" : ""}`} onClick={() => { setPeriod(m); close() }}>{monthLabel(m)}</button>
            ))}
          </Popover>
          <Button variant="secondary" onClick={exportReport}><Download size={17} /> Export report</Button>
        </div>
      </div>
      <div className="analytics-summary">
        <div>
          <span>Total spending</span><strong>{money(s.total)}</strong>
          {ch === null ? <small>No data for {monthName(s.prevYm)}</small> : (
            <small className={ch <= 0 ? "positive" : "negative-text"}>{ch <= 0 ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />} {Math.abs(ch).toFixed(1)}% vs {monthName(s.prevYm)}</small>
          )}
        </div>
        <div><span>Daily average</span><strong>{money(s.dailyAvg)}</strong><small>Based on {s.elapsed} days</small></div>
        <div><span>Transactions</span><strong>{s.month.length}</strong><small>{perDay.toFixed(1)} per day</small></div>
        <div><span>Projected total</span><strong>{money(s.projected)}</strong><small>By {monthName(period, "short")} {s.days}</small></div>
      </div>
      <div className="analytics-grid">
        <section className="panel analytics-trend">
          <SectionHeader title="Spending over time" subtitle={view === "Monthly" ? "Last 12 months" : `${monthName(period, "short")} 1 – ${monthName(period, "short")} ${s.days}, ${period.slice(0, 4)}`}
            action={<Segmented options={["Daily", "Weekly", "Monthly"] as const} value={view} onChange={setView} />} />
          <TrendChart points={points} money={money} />
        </section>
        <section className="panel">
          <SectionHeader title="Spending by category" subtitle="Share of total expenses" />
          <Donut items={s.byCategory.map((r) => ({ name: r.cat.name, color: r.cat.color, amount: r.amount }))} money={money} />
        </section>
        <section className="panel comparison-panel">
          <SectionHeader title="Monthly comparison" subtitle="Last six months" />
          <BarChart items={six} />
        </section>
        <section className="panel top-spend-panel">
          <SectionHeader title="Top spending categories" subtitle={`Ranked by total in ${monthName(period)}`} />
          {top.length === 0 && <p style={{ color: "var(--muted)", fontSize: 11 }}>No spending in {monthLabel(period)} yet.</p>}
          {top.map((r, i) => (
            <div className="rank-row" key={r.cat.id}>
              <b>{i + 1}</b>
              <span className="category-mini-icon" style={{ background: tint(r.cat.color), color: r.cat.color }}><CatIcon cat={r.cat} size={16} /></span>
              <div><strong>{r.cat.name}</strong><small>{r.count} transaction{r.count === 1 ? "" : "s"}</small></div>
              <span className="rank-bar"><i style={{ width: `${(r.amount / topMax) * 100}%`, background: r.cat.color }} /></span>
              <strong>{money(r.amount)}</strong>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
