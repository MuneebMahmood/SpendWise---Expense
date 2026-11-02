import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Bell, CalendarDays, Check, ChevronDown, Lock, LogOut, Menu, Plus, Search, Settings as SettingsIcon, Sparkles, WalletCards, X } from "lucide-react"
import { AppCtx, type ConfirmOpts, type Ctx, type ToastOpts } from "./ctx"
import type { Category, Expense, Page } from "./types"
import { useStore } from "./lib/store"
import { auth, type AuthUser } from "./lib/backend"
import { Splash } from "./Auth"
import { currentYm, makeMoney, monthLabel, sha256, ymOf } from "./lib/format"
import { buildNotifs, computeStats } from "./lib/stats"
import { Avatar } from "./components/Avatar"
import { BudgetDialog, CategoryModal, ConfirmDialog, DeleteCategoryDialog, ExpenseDrawer, ExpenseModal } from "./components/modals"
import { Button, IconButton, Popover } from "./components/ui"
import Overview from "./pages/Overview"
import Expenses from "./pages/Expenses"
import Categories from "./pages/Categories"
import Analytics from "./pages/Analytics"
import Budgets from "./pages/Budgets"
import SettingsPage from "./pages/Settings"
import { BarChart3, Receipt, Target, LayoutDashboard } from "lucide-react"

const NAV: { label: Page; icon: typeof Menu }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "All Expenses", icon: Receipt },
  { label: "Categories", icon: WalletCards },
  { label: "Analytics & Reports", icon: BarChart3 },
  { label: "Monthly Budgets", icon: Target },
  { label: "Settings", icon: SettingsIcon },
]
const SHORT: Partial<Record<Page, string>> = { "All Expenses": "Expenses", "Analytics & Reports": "Reports", "Monthly Budgets": "Budgets" }

type ToastState = { id: number; msg: string; sub?: string; action?: ToastOpts["action"] } | null

function LockScreen({ hash, onUnlock }: { hash: string; onUnlock: () => void }) {
  const [pin, setPin] = useState("")
  const [err, setErr] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if ((await sha256(pin)) === hash) { sessionStorage.setItem("spendwise:unlocked", "1"); onUnlock() }
    else { setErr(true); setPin("") }
  }
  return (
    <div className="lock-screen">
      <form onSubmit={submit}>
        <span className="brand-mark"><Lock size={21} /></span>
        <h1>SpendWise is locked</h1>
        <p>Enter your PIN to continue.</p>
        <input autoFocus type="password" inputMode="numeric" value={pin} aria-label="PIN" placeholder="••••"
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setErr(false) }} />
        {err && <em className="field-error">Incorrect PIN. Try again.</em>}
        <Button type="submit" disabled={pin.length < 4}>Unlock</Button>
      </form>
    </div>
  )
}

export default function App({ user }: { user: AuthUser }) {
  const [toastState, setToastState] = useState<ToastState>(null)
  const toastTimer = useRef<number>(0)
  const toast = useCallback((msg: string, o?: ToastOpts) => {
    window.clearTimeout(toastTimer.current)
    setToastState({ id: Date.now(), msg, sub: o?.sub, action: o?.action })
    toastTimer.current = window.setTimeout(() => setToastState(null), o?.action ? 6500 : 3800)
  }, [])
  const store = useStore(user.id, (msg) => toast("Something went wrong", { sub: msg }))
  const { db } = store

  const [page, setPageRaw] = useState<Page>("Overview")
  const [search, setSearch] = useState("")
  const [sidebar, setSidebar] = useState(false)
  const [expenseModal, setExpenseModal] = useState<{ expense: Expense | null } | null>(null)
  const [categoryModal, setCategoryModal] = useState<{ category: Category | null } | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [budgetTarget, setBudgetTarget] = useState<string | null>(null)
  const [deleteCat, setDeleteCat] = useState<Category | null>(null)
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOpts | null>(null)
  const [pendingCategory, setPendingCategory] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("spendwise:unlocked") === "1")
  const searchRef = useRef<HTMLInputElement>(null)

  const setPage = useCallback((p: Page) => { setPageRaw(p); setSidebar(false); window.scrollTo({ top: 0 }) }, [])
  const money = useMemo(() => makeMoney(db.settings.currency), [db.settings.currency])
  const months = useMemo(() => {
    const set = new Set<string>([currentYm(), db.period, ...db.expenses.map((e) => ymOf(e.date))])
    return Array.from(set).sort().reverse()
  }, [db.expenses, db.period])
  const period = db.period

  useEffect(() => { document.title = "SpendWise — Expense Dashboard" }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [])

  const stats = useMemo(() => computeStats(db, period), [db, period])
  const notifs = useMemo(() => buildNotifs(db, stats, money), [db, stats, money])
  const unread = notifs.filter((n) => !db.readNotifs.includes(n.id))

  const ctx: Ctx = {
    ...store, money, user, signOut: () => { sessionStorage.removeItem("spendwise:unlocked"); auth.signOut().catch((e: Error) => toast("Couldn't sign out", { sub: e.message })) }, page, setPage, search, setSearch, months, period,
    openExpense: (e) => setExpenseModal({ expense: e ?? null }),
    openCategory: (c) => setCategoryModal({ category: c ?? null }),
    openDetail: setDetailId,
    openBudget: setBudgetTarget,
    askDeleteCategory: setDeleteCat,
    confirm: setConfirmOpts,
    toast,
    goExpenses: (category) => { setSearch(""); setPendingCategory(category ?? null); setPage("All Expenses") },
    pendingCategory,
    clearPending: useCallback(() => setPendingCategory(null), []),
  }

  if (db.settings.pinHash && !unlocked) return <LockScreen hash={db.settings.pinHash} onUnlock={() => setUnlocked(true)} />

  if (store.status === "loading") return <Splash text="Loading your data…" />
  if (store.status === "error")
    return (
      <div className="lock-screen"><div className="auth-card-static">
        <h1>Couldn’t load your data</h1><p>{store.loadError}</p>
        <p style={{ fontSize: 10 }}>Check your connection, and that the SQL schema was run in Supabase.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <Button onClick={store.retry}>Try again</Button><Button variant="secondary" onClick={ctx.signOut}>Sign out</Button>
        </div>
      </div></div>
    )
  const budgetPct = Math.round(stats.usedPct)
  const views: Record<Page, React.ReactNode> = {
    Overview: <Overview />, "All Expenses": <Expenses />, Categories: <Categories />,
    "Analytics & Reports": <Analytics />, "Monthly Budgets": <Budgets />, Settings: <SettingsPage />,
  }

  return (
    <AppCtx.Provider value={ctx}>
      <div className="app-shell">
        {sidebar && <button className="mobile-overlay" aria-label="Close menu" onClick={() => setSidebar(false)} />}
        <aside className={`sidebar ${sidebar ? "sidebar-open" : ""}`}>
          <div className="brand">
            <span className="brand-mark"><WalletCards size={21} strokeWidth={2.3} /></span>
            <span>Spend<span>Wise</span></span>
            <IconButton label="Close menu" className="sidebar-close" onClick={() => setSidebar(false)}><X size={20} /></IconButton>
          </div>
          <div className="workspace-label">WORKSPACE</div>
          <nav className="nav-list">
            {NAV.map(({ label, icon: Icon }) => (
              <button key={label} className={`nav-item ${page === label ? "active" : ""}`} onClick={() => setPage(label)}>
                <Icon size={19} strokeWidth={1.9} /><span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-card">
            <span className="sidebar-card-icon"><Sparkles size={17} /></span>
            <strong>Make every rupee count</strong>
            <p>{db.settings.overallBudget > 0 ? `You've used ${budgetPct}% of ${monthLabel(period)}'s budget.` : "Set a monthly budget to track your progress."}</p>
            <div className="mini-progress"><i style={{ width: `${Math.min(100, budgetPct)}%`, background: budgetPct > 100 ? "#f87171" : undefined }} /></div>
          </div>
          <div className="profile-card">
            <Avatar name={db.settings.name} photo={db.settings.photo} />
            <span className="profile-copy"><strong>{db.settings.name || user.email.split("@")[0]}</strong><small>{db.settings.email || user.email}</small></span>
            <IconButton label="Profile settings" onClick={() => setPage("Settings")}><SettingsIcon size={17} /></IconButton>
            <IconButton label="Sign out" onClick={ctx.signOut}><LogOut size={17} /></IconButton>
          </div>
        </aside>

        <div className="app-main">
          <header className="topbar">
            <div className="topbar-title">
              <IconButton label="Open menu" className="menu-button" onClick={() => setSidebar(true)}><Menu size={22} /></IconButton>
              <div><small>SpendWise /</small><strong>{page}</strong></div>
            </div>
            <div className="topbar-actions">
              <label className="search-field">
                <Search size={18} />
                <input ref={searchRef} value={search} placeholder="Search expenses..."
                  onChange={(e) => { setSearch(e.target.value); if (page !== "All Expenses") setPage("All Expenses") }}
                  onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); e.currentTarget.blur() } }} />
                {search ? <button type="button" className="clear-x" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button> : <kbd>{/Mac/i.test(navigator.platform) ? "⌘ K" : "Ctrl K"}</kbd>}
              </label>
              <Popover trigger={({ toggle }) => (
                <button className="period-select" onClick={toggle}><CalendarDays size={17} /><span>{monthLabel(period)}</span><ChevronDown size={15} /></button>
              )}>
                {(close) => (<><div className="menu-title">Select period</div>{months.map((m) => (
                  <button key={m} className={`menu-item ${m === period ? "active" : ""}`} onClick={() => { store.setPeriod(m); close() }}>
                    {monthLabel(m)}{m === period && <Check size={14} />}
                  </button>
                ))}</>)}
              </Popover>
              <Popover className="notif-menu" trigger={({ toggle }) => (
                <IconButton label="Notifications" className="notification-button" onClick={toggle}><Bell size={19} />{unread.length > 0 && <i />}</IconButton>
              )}>
                {(close) => (
                  <>
                    <div className="menu-title notif-title">
                      <span>Notifications {unread.length > 0 && <b>{unread.length}</b>}</span>
                      {unread.length > 0 && <button onClick={() => store.markRead(notifs.map((n) => n.id))}>Mark all read</button>}
                    </div>
                    {notifs.length === 0 && <p className="notif-empty">You're all caught up. Alerts appear here when budgets are close to their limits.</p>}
                    {notifs.map((n) => (
                      <button key={n.id} className={`notif ${n.tone} ${db.readNotifs.includes(n.id) ? "read" : ""}`}
                        onClick={() => { store.markRead([n.id]); close(); if (n.expenseId) setDetailId(n.expenseId); else if (n.page) setPage(n.page) }}>
                        <i /><span><strong>{n.title}</strong><small>{n.text}</small></span>
                      </button>
                    ))}
                  </>
                )}
              </Popover>
              <Button onClick={() => ctx.openExpense(null)}><Plus size={18} /> <span>Add Expense</span></Button>
            </div>
          </header>
          {views[page]}
        </div>

        <nav className="mobile-nav">
          {NAV.slice(0, 5).map(({ label, icon: Icon }) => (
            <button key={label} className={page === label ? "active" : ""} onClick={() => setPage(label)}>
              <Icon size={20} /><span>{SHORT[label] ?? label}</span>
            </button>
          ))}
        </nav>
        <button className="mobile-add" onClick={() => ctx.openExpense(null)} aria-label="Add expense"><Plus size={24} /></button>

        {expenseModal && <ExpenseModal key={expenseModal.expense?.id ?? "new"} expense={expenseModal.expense} onClose={() => setExpenseModal(null)} />}
        {categoryModal && <CategoryModal category={categoryModal.category} onClose={() => setCategoryModal(null)} />}
        {deleteCat && <DeleteCategoryDialog category={deleteCat} onClose={() => setDeleteCat(null)} />}
        {budgetTarget && <BudgetDialog target={budgetTarget} onClose={() => setBudgetTarget(null)} />}
        {detailId && <ExpenseDrawer id={detailId} onClose={() => setDetailId(null)} />}
        {confirmOpts && <ConfirmDialog {...confirmOpts} onClose={() => setConfirmOpts(null)} />}
        {toastState && (
          <div className="toast" role="status" key={toastState.id}>
            <span><Check size={17} /></span>
            <div><strong>{toastState.msg}</strong>{toastState.sub && <small>{toastState.sub}</small>}</div>
            {toastState.action && <button className="toast-action" onClick={() => { toastState.action!.run(); setToastState(null) }}>{toastState.action.label}</button>}
            <button className="toast-x" aria-label="Dismiss" onClick={() => setToastState(null)}><X size={16} /></button>
          </div>
        )}
      </div>
    </AppCtx.Provider>
  )
}
