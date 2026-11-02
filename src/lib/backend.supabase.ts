import { createClient, type Session } from "@supabase/supabase-js"
import type { Api, Auth, AuthUser, CategoryRow, ExpenseRow, MethodRow, ProfileRow } from "./backend"
import { DEFAULT_CATEGORIES, DEFAULT_METHODS } from "./backend"

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabaseConfigured = !!url && !!key

export const supabase = createClient(url || "http://localhost", key || "missing", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

const toUser = (s: Session | null): AuthUser | null =>
  s?.user ? { id: s.user.id, email: s.user.email ?? "", name: (s.user.user_metadata?.full_name as string) ?? "" } : null

export const supabaseAuth: Auth = {
  async getUser() {
    const { data } = await supabase.auth.getSession()
    return toUser(data.session)
  },
  onChange(cb) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") cb("PASSWORD_RECOVERY", toUser(session))
      else if (event === "SIGNED_OUT") cb("SIGNED_OUT", null)
      else if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED") cb("SIGNED_IN", toUser(session))
    })
    return () => data.subscription.unsubscribe()
  },
  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  },
  async signUp(email, password, name) {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
    })
    if (error) throw new Error(error.message)
    // With email confirmation on, an already-registered email returns a user with no identities.
    if (data.user && data.user.identities && data.user.identities.length === 0) throw new Error("An account with this email already exists. Try signing in.")
    return { needsConfirm: !data.session }
  },
  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  },
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (error) throw new Error(error.message)
  },
  async updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(error.message)
  },
}

function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

export function makeSupabaseApi(uid: string): Api {
  const db = supabase
  return {
    async loadAll() {
      let profile = check(await db.from("profiles").select("*").eq("id", uid).maybeSingle()) as ProfileRow | null
      // Accounts created before the schema's signup trigger existed won't have a profile yet.
      if (!profile) {
        const { data: u } = await supabase.auth.getUser()
        check(await db.from("profiles").insert({ id: uid, email: u.user?.email ?? "", full_name: (u.user?.user_metadata?.full_name as string) ?? "" }))
        check(await db.from("categories").insert(DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: uid }))))
        check(await db.from("payment_methods").insert(DEFAULT_METHODS.map((name) => ({ name, user_id: uid }))))
        profile = check(await db.from("profiles").select("*").eq("id", uid).single()) as ProfileRow
      }
      const [cats, methods, reads] = await Promise.all([
        db.from("categories").select("id,name,icon,color,monthly_budget").order("created_at"),
        db.from("payment_methods").select("id,name").order("created_at"),
        db.from("notification_reads").select("notification_key"),
      ])
      const expenses: ExpenseRow[] = []
      for (let from = 0; ; from += 1000) {
        const page = check(await db.from("expenses").select("*").order("expense_date", { ascending: false }).range(from, from + 999)) as ExpenseRow[]
        expenses.push(...page)
        if (page.length < 1000) break
      }
      return {
        profile,
        categories: check(cats) as CategoryRow[],
        methods: check(methods) as MethodRow[],
        expenses,
        reads: (check(reads) as { notification_key: string }[]).map((r) => r.notification_key),
      }
    },
    async updateProfile(patch) { check(await db.from("profiles").update(patch).eq("id", uid)) },
    async insertCategory(c) { check(await db.from("categories").insert({ ...c, user_id: uid })) },
    async updateCategory(id, patch) { check(await db.from("categories").update(patch).eq("id", id)) },
    async deleteCategory(id) { check(await db.from("categories").delete().eq("id", id)) },
    async moveExpenses(from, to) { check(await db.from("expenses").update({ category_id: to }).eq("category_id", from)) },
    async insertMethod(m) { check(await db.from("payment_methods").insert({ ...m, user_id: uid })) },
    async deleteMethod(id) { check(await db.from("payment_methods").delete().eq("id", id)) },
    async insertExpenses(rows) {
      for (let i = 0; i < rows.length; i += 500)
        check(await db.from("expenses").insert(rows.slice(i, i + 500).map((r) => ({ ...r, user_id: uid }))))
    },
    async updateExpense(id, patch) { check(await db.from("expenses").update(patch).eq("id", id)) },
    async deleteExpense(id) { check(await db.from("expenses").delete().eq("id", id)) },
    async deleteAllExpenses() { check(await db.from("expenses").delete().eq("user_id", uid)) },
    async markRead(keys) {
      if (!keys.length) return
      check(await db.from("notification_reads").upsert(keys.map((k) => ({ user_id: uid, notification_key: k })), { onConflict: "user_id,notification_key" }))
    },
    async uploadReceipt(path, dataUrl) {
      const blob = await (await fetch(dataUrl)).blob()
      const { error } = await supabase.storage.from("receipts").upload(path, blob, { contentType: blob.type, upsert: true })
      if (error) throw new Error(error.message)
    },
    async removeReceipt(path) {
      const { error } = await supabase.storage.from("receipts").remove([path])
      if (error) throw new Error(error.message)
    },
    async receiptUrl(path) {
      const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 3600)
      if (error || !data) throw new Error(error?.message ?? "Receipt not found")
      return data.signedUrl
    },
  }
}
