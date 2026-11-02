import type { Category, DB, Expense, Notif } from "../types"
import { addMonths, currentYm, daysIn, fmtShort, monthName, pad, parseISO, pctChange, toISO, todayISO } from "./format"

export const sum = (l: Expense[]) => l.reduce((s, e) => s + e.amount, 0)
export const inMonth = (l: Expense[], ym: string) => l.filter((e) => e.date.startsWith(ym))
export const sortNewest = (l: Expense[]) =>
  [...l].sort((a, b) => (b.date + b.time + b.createdAt).localeCompare(a.date + a.time + a.createdAt))

/** Days of the month that have "elapsed" – full month for past periods, today for the current one. */
export const elapsedDays = (ym: string) => {
  const cur = currentYm()
  if (ym === cur) return new Date().getDate()
  if (ym > cur) return 1
  return daysIn(ym)
}
export const refISO = (ym: string) => `${ym}-${pad(elapsedDays(ym))}`
export const daysLeft = (ym: string) => (ym === currentYm() ? daysIn(ym) - new Date().getDate() : ym > currentYm() ? daysIn(ym) : 0)

export const categorySpend = (expenses: Expense[], categories: Category[]) =>
  categories
    .map((c) => {
      const list = expenses.filter((e) => e.category === c.name)
      return { cat: c, amount: sum(list), count: list.length }
    })
    .sort((a, b) => b.amount - a.amount)

export function computeStats(db: DB, ym: string) {
  const all = db.expenses
  const month = inMonth(all, ym)
  const prevYm = addMonths(ym, -1)
  const prevMonth = inMonth(all, prevYm)
  const elapsed = elapsedDays(ym)
  const total = sum(month)
  const prevTotal = sum(prevMonth)
  const prevSameWindow = sum(prevMonth.filter((e) => Number(e.date.slice(8)) <= elapsed))
  const dailyAvg = total / elapsed
  const prevDaily = prevTotal / daysIn(prevYm)
  const largest = month.length ? [...month].sort((a, b) => b.amount - a.amount)[0] : null
  const budget = db.settings.overallBudget
  const usedPct = budget > 0 ? (total / budget) * 100 : 0
  const byCategory = categorySpend(month, db.categories)
  const projected = ym === currentYm() ? dailyAvg * daysIn(ym) : total
  return {
    ym, prevYm, month, prevMonth, elapsed, total, prevTotal, prevSameWindow, dailyAvg, prevDaily,
    largest, budget, usedPct, byCategory, projected, days: daysIn(ym), left: daysLeft(ym),
    allTotal: sum(all),
    change: pctChange(total, prevTotal),
  }
}
export type Stats = ReturnType<typeof computeStats>

export const budgetState = (pct: number, threshold = 80) =>
  pct > 100 ? "Exceeded" : pct >= threshold ? "Near limit" : "On track"

export const healthScore = (s: Stats) => {
  if (s.budget <= 0) return { score: null as number | null, label: "Set a budget" }
  const elapsedPct = (s.elapsed / s.days) * 100
  let score = 100 - Math.max(0, s.usedPct - elapsedPct) * 1.2 - Math.max(0, s.usedPct - 100) * 0.8
  score = Math.max(5, Math.min(99, Math.round(score)))
  return { score, label: score >= 80 ? "Looking good" : score >= 60 ? "Keep an eye" : "Needs attention" }
}

/* ---------- chart series ---------- */
export type Point = { label: string; value: number; tip: string }

export const dailySeries = (expenses: Expense[], ym: string, days = elapsedDays(ym)): Point[] =>
  Array.from({ length: days }, (_, i) => {
    const iso = `${ym}-${pad(i + 1)}`
    return { label: fmtShort(iso), value: sum(expenses.filter((e) => e.date === iso)), tip: fmtShort(iso) }
  })

export const lastDaysSeries = (expenses: Expense[], endISO: string, n = 7): Point[] => {
  const end = parseISO(endISO)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (n - 1 - i))
    const iso = toISO(d)
    return { label: fmtShort(iso), value: sum(expenses.filter((e) => e.date === iso)), tip: fmtShort(iso) }
  })
}

export const weeklySeries = (expenses: Expense[], ym: string): Point[] => {
  const n = daysIn(ym)
  const out: Point[] = []
  for (let start = 1; start <= n; start += 7) {
    const end = Math.min(start + 6, n)
    const v = sum(expenses.filter((e) => e.date.startsWith(ym) && +e.date.slice(8) >= start && +e.date.slice(8) <= end))
    const label = `${monthName(ym, "short")} ${start}–${end}`
    out.push({ label, value: v, tip: label })
  }
  return out
}

export const monthsSeries = (expenses: Expense[], endYm: string, count = 12): Point[] =>
  Array.from({ length: count }, (_, i) => {
    const ym = addMonths(endYm, -(count - 1 - i))
    return { label: monthName(ym, "short"), value: sum(inMonth(expenses, ym)), tip: `${monthName(ym, "long")} ${ym.slice(0, 4)}` }
  })

export const yearSeries = (expenses: Expense[], ym: string): Point[] =>
  Array.from({ length: 12 }, (_, i) => {
    const m = `${ym.slice(0, 4)}-${pad(i + 1)}`
    return { label: monthName(m, "short"), value: sum(inMonth(expenses, m)), tip: `${monthName(m, "long")} ${ym.slice(0, 4)}` }
  })

/* ---------- smart insight ---------- */
export function insight(db: DB, s: Stats, money: (n: number) => string) {
  const rows = db.categories.map((c) => {
    const now = sum(s.month.filter((e) => e.category === c.name))
    const prev = sum(s.prevMonth.filter((e) => e.category === c.name && +e.date.slice(8) <= s.elapsed))
    return { c, now, prev, diff: now - prev, pct: pctChange(now, prev) }
  })
  const up = rows.filter((r) => r.pct !== null && r.diff > 0).sort((a, b) => b.diff - a.diff)[0]
  if (up && up.pct !== null)
    return { title: `${up.c.name.split(" & ")[0]} spending is ${Math.round(up.pct)}% higher`, text: `You've spent ${money(up.diff)} more on ${up.c.name.toLowerCase()} than at this point last month.` }
  const down = rows.filter((r) => r.pct !== null && r.diff < 0).sort((a, b) => a.diff - b.diff)[0]
  if (down && down.pct !== null)
    return { title: `${down.c.name.split(" & ")[0]} spending is down ${Math.abs(Math.round(down.pct))}%`, text: `Nice work — you've spent ${money(-down.diff)} less on ${down.c.name.toLowerCase()} than last month.` }
  const top = s.byCategory[0]
  if (top && top.amount > 0)
    return { title: `${top.cat.name} leads your spending`, text: `${money(top.amount)} so far, ${Math.round((top.amount / s.total) * 100)}% of everything you've spent this month.` }
  return { title: "No spending yet", text: "Add your first expense to start seeing personalised insights." }
}

/* ---------- notifications ---------- */
export function buildNotifs(db: DB, s: Stats, money: (n: number) => string): Notif[] {
  const out: Notif[] = []
  const { notify, alertThreshold } = db.settings
  if (notify.budget) {
    if (s.budget > 0 && s.usedPct >= alertThreshold) {
      const over = s.usedPct > 100
      out.push({ id: `b:${s.ym}:overall:${over ? "over" : "near"}`, tone: over ? "danger" : "warn", page: "Monthly Budgets",
        title: over ? "Monthly budget exceeded" : "Monthly budget almost used",
        text: `${money(s.total)} of ${money(s.budget)} spent (${Math.round(s.usedPct)}%).` })
    }
    for (const r of s.byCategory) {
      if (!r.cat.budget) continue
      const pct = (r.amount / r.cat.budget) * 100
      if (pct >= alertThreshold) {
        const over = pct > 100
        out.push({ id: `b:${s.ym}:${r.cat.id}:${over ? "over" : "near"}`, tone: over ? "danger" : "warn", page: "Monthly Budgets",
          title: over ? `${r.cat.name} budget exceeded` : `${r.cat.name} nearing its limit`,
          text: `${money(r.amount)} of ${money(r.cat.budget)} used (${Math.round(pct)}%).` })
      }
    }
  }
  if (notify.unusual) {
    sortNewest(s.month).forEach((e) => {
      const others = db.expenses.filter((x) => x.category === e.category && x.id !== e.id)
      if (others.length < 3) return
      const avg = sum(others) / others.length
      if (e.amount >= avg * 2 && out.filter((n) => n.id.startsWith("u:")).length < 3)
        out.push({ id: `u:${e.id}`, tone: "info", expenseId: e.id,
          title: `Unusual: ${e.title}`, text: `${money(e.amount)} is ${(e.amount / avg).toFixed(1)}× your usual ${e.category.toLowerCase()} expense.` })
    })
  }
  if (notify.weekly && s.month.length) {
    const end = refISO(s.ym)
    const week = lastDaysSeries(db.expenses, end, 7).reduce((a, p) => a + p.value, 0)
    const prev = lastDaysSeries(db.expenses, toISO(new Date(parseISO(end).getTime() - 7 * 864e5)), 7).reduce((a, p) => a + p.value, 0)
    const ch = pctChange(week, prev)
    out.push({ id: `w:${end}`, tone: "info", page: "Analytics & Reports", title: "Weekly spending summary",
      text: `${money(week)} in the 7 days to ${fmtShort(end)}${ch === null ? "." : ` (${ch >= 0 ? "+" : ""}${Math.round(ch)}% vs the week before).`}` })
  }
  return out
}

export const isCurrentMonth = (ym: string) => ym === currentYm()
export { todayISO }
