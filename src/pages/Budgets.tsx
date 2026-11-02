import { useMemo, useState } from "react"
import { ArrowRight, Ellipsis, Pencil, Plus, Target, Trash2 } from "lucide-react"
import { useApp } from "../ctx"
import { Button, CatIcon, IconButton, MenuItem, Popover, SectionHeader, tint } from "../components/ui"
import { budgetState, computeStats } from "../lib/stats"
import { monthLabel } from "../lib/format"

export default function Budgets() {
  const { db, money, period, openBudget, setCategoryBudget, toast } = useApp()
  const [proj, setProj] = useState(false)
  const s = useMemo(() => computeStats(db, period), [db, period])
  const th = db.settings.alertThreshold
  const budgeted = db.categories.filter((c) => c.budget)
  const left = s.budget - s.total
  const projFactor = s.elapsed ? s.days / s.elapsed : 1
  const closed = s.left === 0

  return (
    <div className="page">
      <div className="page-heading">
        <div><h1>Monthly budgets</h1><p>Set spending guardrails and stay ahead of your monthly goals.</p></div>
        <Button onClick={() => openBudget("new")}><Plus size={18} /> Add budget</Button>
      </div>
      <section className="overall-budget">
        <div className="overall-copy">
          <span className="target-icon"><Target size={23} /></span>
          <div>
            <small>OVERALL MONTHLY BUDGET</small>
            <h2>{s.budget > 0 ? money(s.budget) : "Not set"}</h2>
            <p>{closed ? `${monthLabel(period)} is closed` : `Resets in ${s.left} day${s.left === 1 ? "" : "s"}`}</p>
          </div>
        </div>
        <div className="overall-stats">
          <div><span>Spent</span><strong>{money(s.total)}</strong></div>
          <div><span>{left >= 0 ? "Remaining" : "Over by"}</span><strong>{money(Math.abs(left))}</strong></div>
          <div><span>Used</span><strong>{s.budget > 0 ? `${s.usedPct.toFixed(1)}%` : "–"}</strong></div>
        </div>
        <div className="overall-progress">
          <span style={{ width: `${Math.min(100, s.usedPct)}%`, background: s.usedPct > 100 ? "#f87171" : s.usedPct >= th ? "#fbbf24" : undefined }} />
          <i style={{ left: `${th}%` }}>Alert at {th}%</i>
        </div>
        <Button variant="secondary" onClick={() => openBudget("overall")}>Edit overall budget</Button>
      </section>
      <SectionHeader title="Category budgets" subtitle={`${budgeted.length} active budget${budgeted.length === 1 ? "" : "s"} for ${monthLabel(period)}`}
        action={<button className="text-action" onClick={() => setProj(!proj)}>{proj ? "Hide projections" : "Spending projections"} <ArrowRight size={15} /></button>} />
      {proj && (
        <section className="panel projections">
          <p>Projected end-of-month spend, assuming your current pace continues{closed ? " (month closed — actuals shown)" : ""}.</p>
          {budgeted.length === 0 && <p>Add a category budget to see projections.</p>}
          {budgeted.map((c) => {
            const spent = s.byCategory.find((r) => r.cat.id === c.id)?.amount ?? 0
            const p = closed ? spent : spent * projFactor
            const over = p > (c.budget || 0)
            return (
              <div key={c.id}><span>{c.name}</span><strong className={over ? "warn" : ""}>{money(p)} <small>of {money(c.budget || 0)}</small></strong><em className={over ? "bad" : "ok"}>{over ? `${money(p - (c.budget || 0))} over` : "On track"}</em></div>
            )
          })}
        </section>
      )}
      {budgeted.length === 0 ? (
        <section className="panel"><div className="empty-state"><span><Target size={22} /></span><h3>No category budgets yet</h3><p>Set a limit for a category to track it here.</p><div style={{ marginTop: 14 }}><Button onClick={() => openBudget("new")}>Add budget</Button></div></div></section>
      ) : (
        <div className="budget-grid">
          {budgeted.map((c) => {
            const spent = s.byCategory.find((r) => r.cat.id === c.id)?.amount ?? 0
            const percent = Math.round((spent / (c.budget || 1)) * 100)
            const state = budgetState(percent, th)
            return (
              <article className="budget-card" key={c.id}>
                <div className="budget-card-title">
                  <span className="large-category-icon" style={{ background: tint(c.color), color: c.color }}><CatIcon cat={c} size={21} /></span>
                  <div><h3>{c.name}</h3><span className={`status ${state.toLowerCase().replace(" ", "-")}`}>{state}</span></div>
                  <Popover trigger={({ toggle }) => <IconButton label="Budget options" onClick={toggle}><Ellipsis size={18} /></IconButton>}>
                    {(close) => (
                      <>
                        <MenuItem onClick={() => { close(); openBudget(c.id) }}><Pencil size={15} /> Edit budget</MenuItem>
                        <MenuItem danger onClick={() => { close(); setCategoryBudget(c.id, undefined); toast("Budget removed", { sub: c.name, action: { label: "Undo", run: () => setCategoryBudget(c.id, c.budget) } }) }}><Trash2 size={15} /> Remove budget</MenuItem>
                      </>
                    )}
                  </Popover>
                </div>
                <div className="budget-numbers"><strong>{money(spent)}</strong><span>of {money(c.budget || 0)}</span><i>{percent}%</i></div>
                <div className="progress-track"><span style={{ width: `${Math.min(percent, 100)}%`, background: percent > 100 ? "#DC2626" : percent >= th ? "#D97706" : c.color }} /></div>
                <p>{percent > 100 ? `${money(spent - (c.budget || 0))} over budget` : `${money((c.budget || 0) - spent)} remaining`}</p>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
