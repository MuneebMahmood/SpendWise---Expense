import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Category, DB, Expense, Receipt, Settings } from "../types"
import { currentYm, nowTime, todayISO, uid as newId } from "./format"
import { makeApi, type CategoryRow, type ExpenseInsert, type ExpenseRow, type MethodRow, type ProfileRow } from "./backend"
import { defaultSettings, seedCategories, seedExpenses } from "./seed"

const pinKey = (uid: string) => `spendwise:pin:${uid}`
const periodKey = (uid: string) => `spendwise:period:${uid}`
const num = (v: unknown) => Number(v ?? 0)
const safeName = (n: string) => n.replace(/[^\w.\-]+/g, "_").slice(-80) || "receipt"

const shell = (uid: string): DB => ({
  expenses: [], categories: [], readNotifs: [], period: currentYm(),
  settings: { ...defaultSettings, name: "", email: "", overallBudget: 0, pinHash: localStorage.getItem(pinKey(uid)) ?? undefined },
})

const toCategory = (r: CategoryRow): Category => ({ id: r.id, name: r.name, icon: r.icon, color: r.color, budget: r.monthly_budget ? num(r.monthly_budget) : undefined })
const mimeOf = (path: string) => (/\.pdf$/i.test(path) ? "application/pdf" : /\.png$/i.test(path) ? "image/png" : "image/jpeg")

function toExpense(r: ExpenseRow, cats: CategoryRow[], methods: MethodRow[]): Expense {
  return {
    id: r.id, title: r.title, merchant: r.merchant, subcategory: r.subcategory,
    category: cats.find((c) => c.id === r.category_id)?.name ?? "Uncategorized",
    payment: methods.find((m) => m.id === r.payment_method_id)?.name ?? "Unspecified",
    amount: num(r.amount), date: r.expense_date, time: (r.expense_time ?? "12:00").slice(0, 5),
    note: r.note ?? undefined,
    receipt: r.receipt_path ? { name: r.receipt_path.split("/").pop() ?? "receipt", type: mimeOf(r.receipt_path), path: r.receipt_path } : undefined,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

function toSettings(p: ProfileRow, methods: MethodRow[], uid: string): Settings {
  return {
    name: p.full_name, email: p.email, photo: p.photo_url ?? undefined, currency: p.currency, defaultRange: p.default_range,
    overallBudget: num(p.overall_budget), alertThreshold: p.alert_threshold,
    notify: { budget: p.notify_budget, weekly: p.notify_weekly, unusual: p.notify_unusual },
    paymentMethods: methods.map((m) => m.name),
    pinHash: localStorage.getItem(pinKey(uid)) ?? undefined,
  }
}

export function useStore(uid: string, onError: (msg: string) => void) {
  const api = useMemo(() => makeApi(uid), [uid])
  const [db, setDb] = useState<DB>(() => shell(uid))
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [loadError, setLoadError] = useState("")
  const dbRef = useRef(db)
  const methodsRef = useRef<MethodRow[]>([])
  const errRef = useRef(onError)
  errRef.current = onError
  const pendingRef = useRef(0)

  // Warn before the tab closes while a write is still in flight, so a save is never silently lost.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (pendingRef.current > 0) { e.preventDefault(); e.returnValue = "" } }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [])

  const commit = (fn: (d: DB) => DB) => {
    const next = fn(dbRef.current)
    dbRef.current = next
    setDb(next)
  }

  const load = useCallback(async () => {
    const r = await api.loadAll()
    methodsRef.current = r.methods
    const expenses = r.expenses.map((e) => toExpense(e, r.categories, r.methods))
    const stored = localStorage.getItem(periodKey(uid))
    const latest = expenses.length ? expenses.map((e) => e.date.slice(0, 7)).sort().pop()! : currentYm()
    const period = stored && /^\d{4}-\d{2}$/.test(stored) ? stored : latest
    const next: DB = {
      expenses, categories: r.categories.map(toCategory), readNotifs: r.reads, period,
      settings: toSettings(r.profile, r.methods, uid),
    }
    dbRef.current = next
    setDb(next)
  }, [api, uid])

  const reload = useCallback(() => { load().catch(() => {}) }, [load])

  useEffect(() => {
    let alive = true
    setStatus("loading")
    load().then(() => alive && setStatus("ready")).catch((e: Error) => { if (alive) { setLoadError(e.message); setStatus("error") } })
    return () => { alive = false }
  }, [load])

  /** Fire a write; on failure tell the user and re-sync from the server so the UI never lies. */
  const persist = (p: Promise<unknown>, what: string) => {
    pendingRef.current++
    return p
      .catch((e: Error) => { errRef.current(`${what}: ${e.message}`); reload() })
      .finally(() => { pendingRef.current-- })
  }

  const catId = (name: string) => dbRef.current.categories.find((c) => c.name === name)?.id
  const methodId = (name: string) => methodsRef.current.find((m) => m.name === name)?.id ?? null
  const toRow = (e: Expense, receiptPath: string | null): ExpenseInsert => ({
    id: e.id, category_id: catId(e.category) ?? "", payment_method_id: methodId(e.payment), title: e.title, merchant: e.merchant,
    subcategory: e.subcategory, amount: e.amount, expense_date: e.date, expense_time: e.time, note: e.note ?? null,
    receipt_path: receiptPath, created_at: e.createdAt,
  })
  const setReceiptLocal = (id: string, receipt: Receipt | undefined) =>
    commit((d) => ({ ...d, expenses: d.expenses.map((x) => (x.id === id ? { ...x, receipt } : x)) }))
  const receiptFrom = (id: string, r: Receipt) => {
    const path = `${uid}/${id}/${safeName(r.name)}`
    return { path, receipt: { name: r.name, type: r.type, path } as Receipt }
  }

  /* ---------------- expenses ---------------- */
  const addExpense = (e: Omit<Expense, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString()
    const full: Expense = { ...e, id: newId(), createdAt: now, updatedAt: now }
    commit((d) => ({ ...d, expenses: [full, ...d.expenses], period: e.date.slice(0, 7) }))
    persist((async () => {
      let path: string | null = null
      if (full.receipt?.data) {
        const up = receiptFrom(full.id, full.receipt)
        await api.uploadReceipt(up.path, full.receipt.data)
        path = up.path
        setReceiptLocal(full.id, up.receipt)
      } else path = full.receipt?.path ?? null
      await api.insertExpenses([toRow(full, path)])
    })(), "Couldn't save expense")
    return full
  }

  const updateExpense = (id: string, patch: Partial<Expense>) => {
    const old = dbRef.current.expenses.find((x) => x.id === id)
    commit((d) => ({
      ...d, expenses: d.expenses.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x)),
      period: patch.date ? patch.date.slice(0, 7) : d.period,
    }))
    persist((async () => {
      const row: Partial<ExpenseInsert> = {}
      if (patch.title !== undefined) row.title = patch.title
      if (patch.merchant !== undefined) row.merchant = patch.merchant
      if (patch.subcategory !== undefined) row.subcategory = patch.subcategory
      if (patch.amount !== undefined) row.amount = patch.amount
      if (patch.date !== undefined) row.expense_date = patch.date
      if (patch.time !== undefined) row.expense_time = patch.time
      if ("note" in patch) row.note = patch.note ?? null
      if (patch.category !== undefined) row.category_id = catId(patch.category)
      if (patch.payment !== undefined) row.payment_method_id = methodId(patch.payment)
      if ("receipt" in patch) {
        const r = patch.receipt, oldPath = old?.receipt?.path
        if (!r && oldPath) { row.receipt_path = null; await api.removeReceipt(oldPath).catch(() => {}) }
        else if (r?.data) {
          const up = receiptFrom(id, r)
          await api.uploadReceipt(up.path, r.data)
          row.receipt_path = up.path
          setReceiptLocal(id, up.receipt)
          if (oldPath && oldPath !== up.path) await api.removeReceipt(oldPath).catch(() => {})
        }
      }
      await api.updateExpense(id, row)
    })(), "Couldn't update expense")
  }

  const deleteExpense = (id: string) => {
    commit((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== id) }))
    persist(api.deleteExpense(id), "Couldn't delete expense")
  }
  const restoreExpense = (e: Expense) => {
    commit((d) => ({ ...d, expenses: [e, ...d.expenses] }))
    persist(api.insertExpenses([toRow(e, e.receipt?.path ?? null)]), "Couldn't restore expense")
  }

  /* ---------------- categories ---------------- */
  const saveCategory = (c: Omit<Category, "id"> & { id?: string }) => {
    const row = { name: c.name, icon: c.icon, color: c.color, monthly_budget: c.budget ?? null }
    if (c.id) {
      const id = c.id
      const old = dbRef.current.categories.find((x) => x.id === id)
      commit((d) => ({
        ...d,
        categories: d.categories.map((x) => (x.id === id ? ({ ...x, ...c, id } as Category) : x)),
        expenses: old && old.name !== c.name ? d.expenses.map((e) => (e.category === old.name ? { ...e, category: c.name } : e)) : d.expenses,
      }))
      persist(api.updateCategory(id, row), "Couldn't update category")
    } else {
      const id = newId()
      commit((d) => ({ ...d, categories: [...d.categories, { ...c, id } as Category] }))
      persist(api.insertCategory({ id, ...row }), "Couldn't create category")
    }
  }

  const deleteCategory = (id: string, moveTo?: string) => {
    const cat = dbRef.current.categories.find((c) => c.id === id)
    if (!cat) return
    const target = moveTo ? catId(moveTo) : undefined
    commit((d) => ({
      ...d, categories: d.categories.filter((c) => c.id !== id),
      expenses: moveTo ? d.expenses.map((e) => (e.category === cat.name ? { ...e, category: moveTo } : e)) : d.expenses,
    }))
    persist((async () => {
      if (target) await api.moveExpenses(id, target)
      await api.deleteCategory(id)
    })(), "Couldn't delete category")
  }

  const setCategoryBudget = (id: string, budget?: number) => {
    commit((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, budget } : c)) }))
    persist(api.updateCategory(id, { monthly_budget: budget ?? null }), "Couldn't save budget")
  }

  /* ---------------- settings ---------------- */
  const updateSettings = (patch: Partial<Settings>) => {
    const prev = dbRef.current.settings
    commit((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
    if ("pinHash" in patch) {
      if (patch.pinHash) localStorage.setItem(pinKey(uid), patch.pinHash)
      else localStorage.removeItem(pinKey(uid))
    }
    const p: Partial<ProfileRow> = {}
    if (patch.name !== undefined) p.full_name = patch.name
    if ("photo" in patch) p.photo_url = patch.photo ?? null
    if (patch.currency) p.currency = patch.currency
    if (patch.defaultRange) p.default_range = patch.defaultRange
    if (patch.overallBudget !== undefined) p.overall_budget = patch.overallBudget
    if (patch.alertThreshold !== undefined) p.alert_threshold = patch.alertThreshold
    if (patch.notify) { p.notify_budget = patch.notify.budget; p.notify_weekly = patch.notify.weekly; p.notify_unusual = patch.notify.unusual }
    if (Object.keys(p).length) persist(api.updateProfile(p), "Couldn't save settings")

    if (patch.paymentMethods) {
      const next = patch.paymentMethods
      const added = next.filter((n) => !prev.paymentMethods.includes(n))
      const removed = prev.paymentMethods.filter((n) => !next.includes(n))
      const addRows = added.map((name) => ({ id: newId(), name }))
      const removeRows = methodsRef.current.filter((m) => removed.includes(m.name))
      methodsRef.current = [...methodsRef.current.filter((m) => !removed.includes(m.name)), ...addRows]
      persist((async () => {
        for (const m of addRows) await api.insertMethod(m)
        for (const m of removeRows) await api.deleteMethod(m.id)
      })(), "Couldn't update payment accounts")
    }
  }

  const setPeriod = (period: string) => {
    localStorage.setItem(periodKey(uid), period)
    commit((d) => ({ ...d, period }))
  }
  const markRead = (ids: string[]) => {
    commit((d) => ({ ...d, readNotifs: Array.from(new Set([...d.readNotifs, ...ids])) }))
    persist(api.markRead(ids), "Couldn't save notification state")
  }

  /* ---------------- bulk import / reset ---------------- */
  /** Adds missing categories + payment methods by name, optionally wipes expenses, then inserts. Returns rows added. */
  const bulkImport = async (expenses: Expense[], cats: Category[], replace: boolean) => {
    const catRows = [...dbRef.current.categories]
    const ids = new Map(catRows.map((c) => [c.name, c.id]))
    for (const name of new Set(expenses.map((e) => e.category))) {
      if (ids.has(name)) continue
      const src = cats.find((c) => c.name === name)
      const row: CategoryRow = { id: newId(), name, icon: src?.icon ?? "money", color: src?.color ?? "#0F766E", monthly_budget: src?.budget ?? null }
      await api.insertCategory(row)
      ids.set(name, row.id)
    }
    const methods = [...methodsRef.current]
    for (const name of new Set(expenses.map((e) => e.payment))) {
      if (!name || name === "Unspecified" || methods.some((m) => m.name === name)) continue
      const m = { id: newId(), name }
      await api.insertMethod(m)
      methods.push(m)
    }
    if (replace) await api.deleteAllExpenses()
    const rows: ExpenseInsert[] = []
    for (const e of expenses) {
      const id = newId()
      let path: string | null = null
      if (e.receipt?.data) {
        path = `${uid}/${id}/${safeName(e.receipt.name)}`
        await api.uploadReceipt(path, e.receipt.data).catch(() => { path = null })
      }
      rows.push({
        id, category_id: ids.get(e.category)!, payment_method_id: methods.find((m) => m.name === e.payment)?.id ?? null,
        title: e.title, merchant: e.merchant, subcategory: e.subcategory, amount: e.amount, expense_date: e.date,
        expense_time: e.time, note: e.note ?? null, receipt_path: path,
      })
    }
    await api.insertExpenses(rows)
    if (rows.length) localStorage.setItem(periodKey(uid), rows.map((r) => r.expense_date.slice(0, 7)).sort().pop()!)
    await load()
    return rows.length
  }

  const importDB = (raw: Partial<DB>) => bulkImport(raw.expenses ?? [], raw.categories ?? [], true)
  const loadSample = () => bulkImport(seedExpenses(), seedCategories, true)
  const importLegacy = () => {
    const raw = JSON.parse(localStorage.getItem("spendwise:v1") ?? "{}") as Partial<DB>
    return bulkImport(raw.expenses ?? [], raw.categories ?? [], false)
  }
  const hasLegacy = () => { try { return ((JSON.parse(localStorage.getItem("spendwise:v1") ?? "{}") as Partial<DB>).expenses?.length ?? 0) > 0 } catch { return false } }
  const clearAll = () => {
    commit((d) => ({ ...d, expenses: [] }))
    persist(api.deleteAllExpenses(), "Couldn't delete expenses")
  }
  const receiptUrl = (path: string) => api.receiptUrl(path)

  return {
    db, status, loadError, retry: () => { setStatus("loading"); load().then(() => setStatus("ready")).catch((e: Error) => { setLoadError(e.message); setStatus("error") }) },
    addExpense, updateExpense, deleteExpense, restoreExpense, saveCategory, deleteCategory, setCategoryBudget,
    updateSettings, setPeriod, markRead, importDB, loadSample, importLegacy, hasLegacy, clearAll, receiptUrl,
  }
}
export type Store = ReturnType<typeof useStore>

export const blankExpense = (period: string) => {
  const cur = currentYm()
  const date = period === cur ? todayISO() : `${period}-${String(new Date(+period.slice(0, 4), +period.slice(5), 0).getDate()).padStart(2, "0")}`
  return { date, time: period === cur ? nowTime() : "12:00" }
}
