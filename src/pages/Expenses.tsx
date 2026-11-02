import { useEffect, useMemo, useState } from "react"
import { Download, Plus, Search, SlidersHorizontal, X } from "lucide-react"
import { useApp } from "../ctx"
import { TransactionTable } from "../components/TransactionTable"
import { Button, EmptyState } from "../components/ui"
import { download, fmtDate, fmtTime, monthLabel, parseISO, toCSV, toISO } from "../lib/format"
import { refISO, sortNewest, sum } from "../lib/stats"
import type { RangeKey } from "../types"

const PAGE_SIZE = 10
const SORTS = ["Newest first", "Oldest first", "Highest amount", "Lowest amount"] as const

export default function Expenses() {
  const { db, money, period, search, setSearch, openExpense, pendingCategory, clearPending, toast } = useApp()
  const [category, setCategory] = useState("All categories")
  const [range, setRange] = useState<RangeKey>(db.settings.defaultRange)
  const [sort, setSort] = useState<(typeof SORTS)[number]>("Newest first")
  const [more, setMore] = useState(false)
  const [payment, setPayment] = useState("All methods")
  const [min, setMin] = useState("")
  const [max, setMax] = useState("")
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (pendingCategory) { setCategory(pendingCategory); setRange("All time"); clearPending() }
  }, [pendingCategory, clearPending])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const end = refISO(period)
    const from30 = toISO(new Date(parseISO(end).getTime() - 29 * 864e5))
    let list = db.expenses.filter((e) => {
      if (range === "This month" && !e.date.startsWith(period)) return false
      if (range === "Last 30 days" && !(e.date >= from30 && e.date <= end)) return false
      if (range === "This year" && !e.date.startsWith(period.slice(0, 4))) return false
      if (category !== "All categories" && e.category !== category) return false
      if (payment !== "All methods" && e.payment !== payment) return false
      if (min && e.amount < Number(min)) return false
      if (max && e.amount > Number(max)) return false
      return !q || `${e.title} ${e.merchant} ${e.note ?? ""} ${e.category} ${e.subcategory}`.toLowerCase().includes(q)
    })
    list = sortNewest(list)
    if (sort === "Oldest first") list.reverse()
    if (sort === "Highest amount") list.sort((a, b) => b.amount - a.amount)
    if (sort === "Lowest amount") list.sort((a, b) => a.amount - b.amount)
    return list
  }, [db.expenses, search, category, range, sort, payment, min, max, period])

  useEffect(() => setPage(1), [search, category, range, sort, payment, min, max, period])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const cur = Math.min(page, pages)
  const shown = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE)
  const activeFilters = [category !== "All categories", payment !== "All methods", !!min, !!max, !!search.trim()].filter(Boolean).length
  const clear = () => { setCategory("All categories"); setPayment("All methods"); setMin(""); setMax(""); setSearch("") }

  const exportCSV = () => {
    if (!filtered.length) return toast("Nothing to export", { sub: "No expenses match the current filters." })
    download(`spendwise-expenses-${new Date().toISOString().slice(0, 10)}.csv`, toCSV([
      ["Date", "Time", "Title", "Merchant", "Category", "Subcategory", "Payment method", "Amount", "Notes"],
      ...filtered.map((e) => [fmtDate(e.date), fmtTime(e.time), e.title, e.merchant, e.category, e.subcategory, e.payment, e.amount, e.note ?? ""]),
    ]))
    toast("Export ready", { sub: `${filtered.length} expenses saved as CSV.` })
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div><h1>All expenses</h1><p>Review, filter and manage every transaction in one place.</p></div>
        <div>
          <Button variant="secondary" onClick={exportCSV}><Download size={17} /> Export</Button>
          <Button onClick={() => openExpense(null)}><Plus size={18} /> Add Expense</Button>
        </div>
      </div>
      <div className="filter-card">
        <label className="filter-search">
          <Search size={18} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, merchant or notes..." />
          {search && <button type="button" className="clear-x" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option>All categories</option>
            {db.categories.map((c) => <option key={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          <span>Date range</span>
          <select value={range} onChange={(e) => setRange(e.target.value as RangeKey)}>
            <option value="This month">{monthLabel(period)}</option>
            <option>Last 30 days</option>
            <option value="This year">Year {period.slice(0, 4)}</option>
            <option>All time</option>
          </select>
        </label>
        <label>
          <span>Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as (typeof SORTS)[number])}>
            {SORTS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <Button variant="secondary" onClick={() => setMore(!more)}>
          <SlidersHorizontal size={17} /> More filters{activeFilters ? ` (${activeFilters})` : ""}
        </Button>
      </div>
      {more && (
        <div className="filter-card more-filters">
          <label>
            <span>Payment method</span>
            <select value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option>All methods</option>
              {db.settings.paymentMethods.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label><span>Min amount</span><input inputMode="numeric" value={min} placeholder="0" onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} /></label>
          <label><span>Max amount</span><input inputMode="numeric" value={max} placeholder="Any" onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} /></label>
          <Button variant="secondary" onClick={clear}>Clear all filters</Button>
        </div>
      )}
      <div className="result-summary">
        <p><strong>{filtered.length} expense{filtered.length === 1 ? "" : "s"}</strong> found</p>
        <p>Filtered spending <strong>{money(sum(filtered))}</strong></p>
      </div>
      <section className="panel expenses-panel">
        {shown.length ? <TransactionTable expenses={shown} /> : (
          <EmptyState title="No expenses found" text={db.expenses.length ? "Try adjusting your search or clearing the active filters." : "You haven't added any expenses yet."}
            action={activeFilters ? <Button variant="secondary" onClick={clear}>Clear filters</Button> : <Button onClick={() => openExpense(null)}>Add expense</Button>} />
        )}
        <div className="pagination">
          <span>{filtered.length ? `Showing ${(cur - 1) * PAGE_SIZE + 1}–${Math.min(cur * PAGE_SIZE, filtered.length)} of ${filtered.length}` : "Showing 0 of 0"}</span>
          <div>
            <Button variant="secondary" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>Previous</Button>
            <Button variant="secondary" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>Next</Button>
          </div>
        </div>
      </section>
    </div>
  )
}
