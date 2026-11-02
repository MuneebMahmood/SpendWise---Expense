// In-memory/localStorage stand-in for Supabase. Only used when built with --mode mock (for offline testing).
import type { Api, Auth, AuthUser, CategoryRow, ExpenseRow, MethodRow, ProfileRow } from "./backend"
import { DEFAULT_CATEGORIES, DEFAULT_METHODS } from "./backend"
import { uid as newId } from "./format"

type Store = { profile: ProfileRow; categories: CategoryRow[]; methods: MethodRow[]; expenses: ExpenseRow[]; reads: string[]; files: Record<string, string> }
type User = AuthUser & { password: string }
const USERS = "mock:users", SESSION = "mock:session"
const read = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) ?? "") as T } catch { return d } }
const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v))
const listeners = new Set<(e: "SIGNED_IN" | "SIGNED_OUT" | "PASSWORD_RECOVERY", u: AuthUser | null) => void>()
const pub = (u: User | null): AuthUser | null => (u ? { id: u.id, email: u.email, name: u.name } : null)
const wait = () => new Promise((r) => setTimeout(r, 15))

const fresh = (email: string, name: string): Store => ({
  profile: { full_name: name, email, photo_url: null, currency: "PKR", default_range: "This month", overall_budget: 0, alert_threshold: 80, notify_budget: true, notify_weekly: true, notify_unusual: true },
  categories: DEFAULT_CATEGORIES.map((c) => ({ ...c, id: newId() })),
  methods: DEFAULT_METHODS.map((name) => ({ id: newId(), name })),
  expenses: [], reads: [], files: {},
})

export const mockAuth: Auth = {
  async getUser() { const id = read<string | null>(SESSION, null); return pub(read<User[]>(USERS, []).find((u) => u.id === id) ?? null) },
  onChange(cb) { listeners.add(cb); return () => { listeners.delete(cb) } },
  async signIn(email, password) {
    await wait()
    const u = read<User[]>(USERS, []).find((x) => x.email === email.toLowerCase() && x.password === password)
    if (!u) throw new Error("Invalid login credentials")
    write(SESSION, u.id); listeners.forEach((l) => l("SIGNED_IN", pub(u)))
  },
  async signUp(email, password, name) {
    await wait()
    const users = read<User[]>(USERS, [])
    if (users.some((u) => u.email === email.toLowerCase())) throw new Error("An account with this email already exists. Try signing in.")
    const u: User = { id: newId(), email: email.toLowerCase(), name, password }
    write(USERS, [...users, u]); write(`mock:data:${u.id}`, fresh(u.email, name))
    write(SESSION, u.id); listeners.forEach((l) => l("SIGNED_IN", pub(u)))
    return { needsConfirm: false }
  },
  async signOut() { localStorage.removeItem(SESSION); listeners.forEach((l) => l("SIGNED_OUT", null)) },
  async resetPassword() { await wait() },
  async updatePassword(password) {
    const id = read<string | null>(SESSION, null)
    write(USERS, read<User[]>(USERS, []).map((u) => (u.id === id ? { ...u, password } : u)))
  },
}

export function makeMockApi(uid: string): Api {
  const k = `mock:data:${uid}`
  const get = () => read<Store>(k, fresh("", ""))
  const mutate = async (fn: (s: Store) => void) => { await wait(); const s = get(); fn(s); write(k, s) }
  const now = () => new Date().toISOString()
  return {
    async loadAll() { await wait(); const s = get(); return { profile: s.profile, categories: s.categories, methods: s.methods, expenses: s.expenses, reads: s.reads } },
    updateProfile: (p) => mutate((s) => { s.profile = { ...s.profile, ...p } }),
    insertCategory: (c) => mutate((s) => { s.categories.push(c) }),
    updateCategory: (id, p) => mutate((s) => { s.categories = s.categories.map((c) => (c.id === id ? { ...c, ...p } : c)) }),
    deleteCategory: (id) => mutate((s) => {
      if (s.expenses.some((e) => e.category_id === id)) throw new Error("update or delete on table \"categories\" violates foreign key constraint")
      s.categories = s.categories.filter((c) => c.id !== id)
    }),
    moveExpenses: (from, to) => mutate((s) => { s.expenses = s.expenses.map((e) => (e.category_id === from ? { ...e, category_id: to } : e)) }),
    insertMethod: (m) => mutate((s) => { s.methods.push(m) }),
    deleteMethod: (id) => mutate((s) => { s.methods = s.methods.filter((m) => m.id !== id); s.expenses = s.expenses.map((e) => (e.payment_method_id === id ? { ...e, payment_method_id: null } : e)) }),
    insertExpenses: (rows) => mutate((s) => { rows.forEach((r) => s.expenses.push({ ...r, created_at: r.created_at ?? now(), updated_at: now() })) }),
    updateExpense: (id, p) => mutate((s) => { s.expenses = s.expenses.map((e) => (e.id === id ? { ...e, ...p, updated_at: now() } : e)) }),
    deleteExpense: (id) => mutate((s) => { s.expenses = s.expenses.filter((e) => e.id !== id) }),
    deleteAllExpenses: () => mutate((s) => { s.expenses = [] }),
    markRead: (keys) => mutate((s) => { s.reads = Array.from(new Set([...s.reads, ...keys])) }),
    uploadReceipt: (path, data) => mutate((s) => { s.files[path] = data }),
    removeReceipt: (path) => mutate((s) => { delete s.files[path] }),
    async receiptUrl(path) { const d = get().files[path]; if (!d) throw new Error("Receipt not found"); return d },
  }
}
