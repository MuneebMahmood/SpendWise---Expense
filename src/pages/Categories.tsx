import { useMemo } from "react"
import { ChevronRight, Ellipsis, Pencil, Plus, Receipt, Trash2 } from "lucide-react"
import { useApp } from "../ctx"
import { CatIcon, IconButton, MenuItem, Popover, tint, Button } from "../components/ui"
import { computeStats } from "../lib/stats"
import { monthName } from "../lib/format"

export default function Categories() {
  const { db, money, period, openCategory, askDeleteCategory, goExpenses } = useApp()
  const s = useMemo(() => computeStats(db, period), [db, period])
  const top = s.byCategory[0]
  return (
    <div className="page">
      <div className="page-heading">
        <div><h1>Categories</h1><p>Organize expenses and set category-level spending limits.</p></div>
        <Button onClick={() => openCategory(null)}><Plus size={18} /> Create category</Button>
      </div>
      <div className="category-summary">
        <div><span>ACTIVE CATEGORIES</span><strong>{db.categories.length}</strong><small>Across all expenses</small></div>
        <div>
          <span>TOP CATEGORY</span>
          <strong>{top && top.amount > 0 ? top.cat.name : "—"}</strong>
          <small>{top && top.amount > 0 ? `${Math.round((top.amount / s.total) * 100)}% of ${monthName(period)} spending` : "No spending this month"}</small>
        </div>
        <div><span>BUDGETED</span><strong>{db.categories.filter((c) => c.budget).length} of {db.categories.length}</strong><small>Categories with limits</small></div>
      </div>
      <div className="category-grid">
        {db.categories.map((c) => {
          const row = s.byCategory.find((r) => r.cat.id === c.id)!
          const percent = s.total ? Math.round((row.amount / s.total) * 100) : 0
          const use = c.budget ? Math.round((row.amount / c.budget) * 100) : 0
          return (
            <article className="category-card" key={c.id}>
              <div className="category-card-top">
                <span className="large-category-icon" style={{ background: tint(c.color), color: c.color }}><CatIcon cat={c} size={22} /></span>
                <Popover trigger={({ toggle }) => <IconButton label={`More options for ${c.name}`} onClick={toggle}><Ellipsis size={19} /></IconButton>}>
                  {(close) => (
                    <>
                      <MenuItem onClick={() => { close(); openCategory(c) }}><Pencil size={15} /> Edit category</MenuItem>
                      <MenuItem onClick={() => { close(); goExpenses(c.name) }}><Receipt size={15} /> View expenses</MenuItem>
                      <MenuItem danger onClick={() => { close(); askDeleteCategory(c) }}><Trash2 size={15} /> Delete</MenuItem>
                    </>
                  )}
                </Popover>
              </div>
              <h3>{c.name}</h3>
              <p>{row.count} transaction{row.count === 1 ? "" : "s"} · {percent}% of spending</p>
              <strong>{money(row.amount)}</strong>
              <small>Spent in {monthName(period)}</small>
              <div className="category-budget-copy">
                <span>Monthly budget</span>
                <span>{c.budget ? `${money(row.amount)} / ${money(c.budget)}` : "Not set"}</span>
              </div>
              <div className="progress-track category-progress">
                <span style={{ width: `${Math.min(use, 100)}%`, background: use > 100 ? "#dc2626" : use >= db.settings.alertThreshold ? "#D97706" : c.color }} />
              </div>
              <div className="category-card-actions">
                <button onClick={() => openCategory(c)}>Edit category</button>
                <button className="chev" aria-label={`View ${c.name} expenses`} onClick={() => goExpenses(c.name)}><ChevronRight size={16} /></button>
              </div>
            </article>
          )
        })}
        <button className="new-category-card" onClick={() => openCategory(null)}>
          <span><Plus size={22} /></span>
          <strong>Create new category</strong>
          <p>Add a custom category with its own icon, color and budget.</p>
        </button>
      </div>
    </div>
  )
}
