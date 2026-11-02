import { createContext, useContext } from "react"
import type { Category, Expense, Page } from "./types"
import type { Store } from "./lib/store"
import type { AuthUser } from "./lib/backend"

export type ConfirmOpts = {
  title: string
  text: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
}
export type ToastOpts = { sub?: string; action?: { label: string; run: () => void } }

export type Ctx = Store & {
  money: (n: number) => string
  user: AuthUser
  signOut: () => void
  page: Page
  setPage: (p: Page) => void
  search: string
  setSearch: (s: string) => void
  months: string[]
  period: string
  openExpense: (e?: Expense | null) => void
  openCategory: (c?: Category | null) => void
  openDetail: (id: string) => void
  confirm: (o: ConfirmOpts) => void
  toast: (msg: string, o?: ToastOpts) => void
  openBudget: (target: string) => void
  askDeleteCategory: (c: Category) => void
  goExpenses: (category?: string) => void
  pendingCategory: string | null
  clearPending: () => void
}

export const AppCtx = createContext<Ctx>(null as unknown as Ctx)
export const useApp = () => useContext(AppCtx)
