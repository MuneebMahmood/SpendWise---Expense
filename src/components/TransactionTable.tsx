import { ChevronRight, CreditCard } from "lucide-react"
import { useApp } from "../ctx"
import type { Expense } from "../types"
import { fmtDate, fmtTime } from "../lib/format"
import { CatIcon, CategoryBadge, tint } from "./ui"

export function TransactionTable({ expenses, compact = false }: { expenses: Expense[]; compact?: boolean }) {
  const { db, money, openDetail } = useApp()
  return (
    <div className={`transaction-table ${compact ? "compact" : ""}`}>
      <div className="table-header">
        <span>Transaction</span><span>Category</span><span>Payment method</span><span>Date</span><span>Amount</span><span />
      </div>
      {expenses.map((e) => {
        const cat = db.categories.find((c) => c.name === e.category)
        return (
          <button className="transaction-row" key={e.id} onClick={() => openDetail(e.id)}>
            <span className="transaction-main">
              <span className="category-icon" style={cat ? { background: tint(cat.color), color: cat.color } : undefined}><CatIcon cat={cat} /></span>
              <span><strong>{e.title}</strong><small>{e.merchant}</small></span>
            </span>
            <CategoryBadge name={e.category} categories={db.categories} />
            <span className="payment"><CreditCard size={16} />{e.payment}</span>
            <span className="date-cell">{fmtDate(e.date)}<small>{fmtTime(e.time)}</small></span>
            <strong className="amount">−{money(e.amount)}</strong>
            <ChevronRight size={17} className="row-arrow" />
          </button>
        )
      })}
    </div>
  )
}
