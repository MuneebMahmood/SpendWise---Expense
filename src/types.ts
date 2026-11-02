export type Page =
  | "Overview"
  | "All Expenses"
  | "Categories"
  | "Analytics & Reports"
  | "Monthly Budgets"
  | "Settings"

export type Receipt = { name: string; type: string; data?: string; path?: string }

export type Expense = {
  id: string
  title: string
  merchant: string
  category: string
  subcategory: string
  payment: string
  amount: number
  date: string // YYYY-MM-DD
  time: string // HH:mm
  note?: string
  receipt?: Receipt
  createdAt: string
  updatedAt: string
}

export type Category = {
  id: string
  name: string
  icon: string
  color: string
  budget?: number
}

export type CurrencyCode = "PKR" | "USD" | "EUR" | "GBP" | "AED" | "SAR"
export type RangeKey = "This month" | "Last 30 days" | "This year" | "All time"

export type Settings = {
  name: string
  email: string
  photo?: string
  currency: CurrencyCode
  defaultRange: RangeKey
  overallBudget: number
  alertThreshold: number
  notify: { budget: boolean; weekly: boolean; unusual: boolean }
  paymentMethods: string[]
  pinHash?: string
}

export type DB = {
  expenses: Expense[]
  categories: Category[]
  settings: Settings
  readNotifs: string[]
  period: string // YYYY-MM
}

export type Notif = {
  id: string
  tone: "warn" | "danger" | "info"
  title: string
  text: string
  page?: Page
  expenseId?: string
}
