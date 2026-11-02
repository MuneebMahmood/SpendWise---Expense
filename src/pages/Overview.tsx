import { useMemo, useState } from "react"
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Ellipsis, Gauge, Receipt, Sparkles, TrendingDown, TrendingUp, WalletCards, Zap } from "lucide-react"
import { useApp } from "../ctx"
import { TransactionTable } from "../components/TransactionTable"
import { Donut, TrendChart } from "../components/charts"
import { Button, CatIcon, EmptyState, SectionHeader, Segmented } from "../components/ui"
import { budgetState, computeStats, dailySeries, healthScore, insight, lastDaysSeries, refISO, sortNewest, yearSeries } from "../lib/stats"
import { fmtShort, monthLabel, monthName, pctChange } from "../lib/format"

function SummaryCard({ label, value, note, icon, tone = "navy", down = false }: {
  label: string; value: string; note: React.ReactNode; icon: React.ReactNode; tone?: string; down?: boolean
}) {
  return (
    <article className="summary-card">
      <div className="summary-top"><span className={`summary-icon ${tone}`}>{icon}</span><Ellipsis size={19} /></div>
      <p>{label}</p>
      <strong className="summary-value">{value}</strong>
      <div className={`summary-note ${down ? "negative" : ""}`}>{note}</div>
    </article>
  )
}

export default function Overview() {
  const { db, money, period, setPage, openExpense, openBudget } = useApp()
  const [range, setRange] = useState<"Week" | "Month" | "Year">("Month")
  const s = useMemo(() => computeStats(db, period), [db, period])
  const health = healthScore(s)
  const ins = insight(db, s, money)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const first = db.settings.name.trim().split(" ")[0] || "there"
  const refDate = new Date(`${refISO(period)}T00:00:00`)
  const eyebrow = refDate.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()

  const points = range === "Week" ? lastDaysSeries(db.expenses, refISO(period), 7)
    : range === "Year" ? yearSeries(db.expenses, period) : dailySeries(db.expenses, period)
  const sub = range === "Week" ? "Last 7 days" : range === "Year" ? `Monthly totals in ${period.slice(0, 4)}` : `Daily expenses during ${monthName(period)}`

  const change = pctChange(s.total, s.prevSameWindow)
  const dailyCh = pctChange(s.dailyAvg, s.prevDaily)
  const budgeted = db.categories.filter((c) => c.budget).map((c) => {
    const spent = s.byCategory.find((r) => r.cat.id === c.id)?.amount ?? 0
    return { c, pct: Math.round((spent / (c.budget || 1)) * 100) }
  }).sort((a, b) => b.pct - a.pct).slice(0, 3)
  const remaining = s.budget - s.total
  const recent = sortNewest(s.month).slice(0, 5)

  return (
    <div className="page">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{greeting}, {first}</h1>
          <p>Here’s how your spending is looking in {monthLabel(period)}.</p>
        </div>
        <div className="health-score" title="Based on how your spending compares with your monthly budget and the days elapsed">
          <span><Gauge size={20} /></span>
          <div><small>Financial health</small><strong>{health.label}</strong></div>
          <i>{health.score ?? "–"}</i>
        </div>
      </div>
      <div className="summary-grid">
        <SummaryCard label="Total expenses" value={money(s.allTotal)} icon={<WalletCards size={21} />}
          note={<><Receipt size={14} /> {db.expenses.length} <span>transactions recorded</span></>} />
        <SummaryCard label="This month" value={money(s.total)} tone="blue" icon={<CalendarDays size={21} />} down={change !== null && change > 0}
          note={change === null ? <span>No spending last month to compare</span> : <>{change > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {Math.abs(change).toFixed(1)}% <span>from {monthName(s.prevYm)}</span></>} />
        <SummaryCard label="Daily average" value={money(s.dailyAvg)} tone="purple" icon={<BarChart3 size={21} />} down={dailyCh !== null && dailyCh > 0}
          note={dailyCh === null ? <span>Over {s.elapsed} days</span> : <>{dailyCh > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {money(Math.abs(s.dailyAvg - s.prevDaily))} <span>{dailyCh > 0 ? "above" : "below"} last month</span></>} />
        <SummaryCard label="Largest expense" value={s.largest ? money(s.largest.amount) : money(0)} tone="orange" icon={<Receipt size={21} />}
          note={s.largest ? <><Zap size={14} /> <span>{s.largest.merchant} · {fmtShort(s.largest.date)}</span></> : <span>Nothing recorded yet</span>} />
      </div>
      <div className="dashboard-grid">
        <section className="panel trend-panel">
          <SectionHeader title="Monthly spending trend" subtitle={sub} action={<Segmented options={["Week", "Month", "Year"] as const} value={range} onChange={setRange} />} />
          <TrendChart points={points} money={money} />
        </section>
        <section className="panel breakdown-panel">
          <SectionHeader title="Expense breakdown" subtitle="By category"
            action={<button className="text-action" onClick={() => setPage("Analytics & Reports")}>Details <ArrowRight size={15} /></button>} />
          <Donut items={s.byCategory.map((r) => ({ name: r.cat.name, color: r.cat.color, amount: r.amount }))} money={money} />
        </section>
      </div>
      <div className="dashboard-grid lower">
        <section className="panel recent-panel">
          <SectionHeader title="Recent transactions" subtitle="Your latest recorded expenses"
            action={<button className="text-action" onClick={() => setPage("All Expenses")}>View all <ArrowRight size={15} /></button>} />
          {recent.length ? <TransactionTable expenses={recent} compact /> : (
            <EmptyState title="No expenses in this period" text="Add an expense to see it here." action={<Button onClick={() => openExpense(null)}>Add expense</Button>} />
          )}
        </section>
        <div className="right-stack">
          <section className="panel budget-panel">
            <SectionHeader title="Budget overview" action={<button className="text-action" onClick={() => setPage("Monthly Budgets")}>Manage</button>} />
            {s.budget > 0 ? (
              <>
                <div className="budget-total">
                  <div><span>Monthly budget</span><strong>{money(s.total)} <small>/ {money(s.budget)}</small></strong></div>
                  <i style={s.usedPct > 100 ? { color: "#b91c1c", background: "#fee2e2" } : s.usedPct >= db.settings.alertThreshold ? { color: "#a16207", background: "#fef9c3" } : undefined}>{Math.round(s.usedPct)}%</i>
                </div>
                <div className="progress-track"><span style={{ width: `${Math.min(100, s.usedPct)}%`, background: s.usedPct > 100 ? "#dc2626" : s.usedPct >= db.settings.alertThreshold ? "#d97706" : undefined }} /></div>
                <p className="budget-caption">
                  <strong>{remaining >= 0 ? money(remaining) : money(-remaining)}</strong> {remaining >= 0 ? "remaining" : "over budget"}
                  {s.left > 0 ? ` · ${s.left} day${s.left > 1 ? "s" : ""} left` : ""}
                </p>
              </>
            ) : (
              <p className="budget-caption">No monthly budget set. <button className="text-action" onClick={() => openBudget("overall")}>Set one</button></p>
            )}
            <div className="budget-mini-list">
              {budgeted.length === 0 && <div><span>No category budgets yet</span></div>}
              {budgeted.map(({ c, pct }) => (
                <div key={c.id}>
                  <span><CatIcon cat={c} size={15} /> {c.name}</span>
                  <strong className={budgetState(pct, db.settings.alertThreshold) !== "On track" ? "warn" : ""}>{pct}%</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="insight-panel">
            <div className="insight-icon"><Sparkles size={19} /></div>
            <div>
              <span>SMART INSIGHT</span>
              <strong>{ins.title}</strong>
              <p>{ins.text}</p>
              <button onClick={() => setPage("Analytics & Reports")}>View insight <ArrowRight size={14} /></button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
