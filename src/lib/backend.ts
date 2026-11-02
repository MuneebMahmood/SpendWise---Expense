import type { CurrencyCode, RangeKey } from "../types"
import { makeMockApi, mockAuth } from "./backend.mock"
import { makeSupabaseApi, supabaseAuth, supabaseConfigured } from "./backend.supabase"

export type AuthUser = { id: string; email: string; name: string }
export type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "PASSWORD_RECOVERY"

export interface Auth {
  getUser(): Promise<AuthUser | null>
  onChange(cb: (e: AuthEvent, u: AuthUser | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string, name: string): Promise<{ needsConfirm: boolean }>
  signOut(): Promise<void>
  resetPassword(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
}

export type ProfileRow = {
  full_name: string
  email: string
  photo_url: string | null
  currency: CurrencyCode
  default_range: RangeKey
  overall_budget: number | string
  alert_threshold: number
  notify_budget: boolean
  notify_weekly: boolean
  notify_unusual: boolean
}
export type CategoryRow = { id: string; name: string; icon: string; color: string; monthly_budget: number | string | null }
export type MethodRow = { id: string; name: string }
export type ExpenseInsert = {
  id: string
  category_id: string
  payment_method_id: string | null
  title: string
  merchant: string
  subcategory: string
  amount: number
  expense_date: string
  expense_time: string
  note: string | null
  receipt_path: string | null
  created_at?: string
}
export type ExpenseRow = ExpenseInsert & { created_at: string; updated_at: string }

export interface Api {
  loadAll(): Promise<{ profile: ProfileRow; categories: CategoryRow[]; methods: MethodRow[]; expenses: ExpenseRow[]; reads: string[] }>
  updateProfile(patch: Partial<ProfileRow>): Promise<void>
  insertCategory(c: CategoryRow): Promise<void>
  updateCategory(id: string, patch: Partial<Omit<CategoryRow, "id">>): Promise<void>
  deleteCategory(id: string): Promise<void>
  moveExpenses(from: string, to: string): Promise<void>
  insertMethod(m: MethodRow): Promise<void>
  deleteMethod(id: string): Promise<void>
  insertExpenses(rows: ExpenseInsert[]): Promise<void>
  updateExpense(id: string, patch: Partial<ExpenseInsert>): Promise<void>
  deleteExpense(id: string): Promise<void>
  deleteAllExpenses(): Promise<void>
  markRead(keys: string[]): Promise<void>
  uploadReceipt(path: string, dataUrl: string): Promise<void>
  removeReceipt(path: string): Promise<void>
  receiptUrl(path: string): Promise<string>
}

const useMock = import.meta.env.VITE_BACKEND === "mock"
export const configured = useMock || supabaseConfigured
export const auth: Auth = useMock ? mockAuth : supabaseAuth
export const makeApi = (uid: string): Api => (useMock ? makeMockApi(uid) : makeSupabaseApi(uid))

export const DEFAULT_CATEGORIES = [
  { name: "Food & Dining", icon: "food", color: "#F97316", monthly_budget: 30000 },
  { name: "Petrol & Fuel", icon: "fuel", color: "#2563EB", monthly_budget: 25000 },
  { name: "Outdoor Activities", icon: "activity", color: "#8B5CF6", monthly_budget: 20000 },
  { name: "Shopping", icon: "shopping", color: "#DB2777", monthly_budget: 20000 },
  { name: "Bills & Utilities", icon: "bills", color: "#0891B2", monthly_budget: 18000 },
  { name: "Healthcare", icon: "health", color: "#16A34A", monthly_budget: 12000 },
]
export const DEFAULT_METHODS = ["Credit Card", "Debit Card", "Cash", "Bank Transfer"]
