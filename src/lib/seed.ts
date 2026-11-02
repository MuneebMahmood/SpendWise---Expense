import type { Category, DB, Expense, Settings } from "../types"
import { currentYm, daysIn, pad } from "./format"

export const defaultSettings: Settings = {
  name: "Muneeb Khan",
  email: "muneeb@spendwise.pk",
  currency: "PKR",
  defaultRange: "This month",
  overallBudget: 105000,
  alertThreshold: 80,
  notify: { budget: true, weekly: true, unusual: true },
  paymentMethods: ["Credit Card", "Debit Card", "Cash", "Bank Transfer"],
}

export const seedCategories: Category[] = [
  { id: "food", name: "Food & Dining", icon: "food", color: "#F97316", budget: 30000 },
  { id: "fuel", name: "Petrol & Fuel", icon: "fuel", color: "#2563EB", budget: 25000 },
  { id: "outdoor", name: "Outdoor Activities", icon: "activity", color: "#8B5CF6", budget: 20000 },
  { id: "shopping", name: "Shopping", icon: "shopping", color: "#DB2777", budget: 20000 },
  { id: "bills", name: "Bills & Utilities", icon: "bills", color: "#0891B2", budget: 18000 },
  { id: "health", name: "Healthcare", icon: "health", color: "#16A34A", budget: 12000 },
]

type Row = [string, string, string, string, string, string, string, number, string?]
const F = "Food & Dining", P = "Petrol & Fuel", O = "Outdoor Activities"
const S = "Shopping", B = "Bills & Utilities", H = "Healthcare"

const may: Row[] = [
  ["2025-05-28", "20:42", "Dinner at Monal", "The Monal", F, "Outdoor Dining", "Credit Card", 4850, "Dinner with family"],
  ["2025-05-27", "18:15", "Monthly fuel refill", "PSO F-7", P, "Petrol", "Debit Card", 8200, "28.4 litres · Odometer 48,221 km"],
  ["2025-05-26", "14:08", "Daraz home order", "Daraz", S, "Household", "Bank Transfer", 6290],
  ["2025-05-24", "10:30", "Electricity bill", "IESCO", B, "Electricity", "Bank Transfer", 11350],
  ["2025-05-23", "13:24", "Lunch delivery", "Foodpanda", F, "Home Delivery", "Cash", 1720],
  ["2025-05-21", "07:05", "Weekend hiking trip", "Trail 5", O, "Trips & Outings", "Cash", 3500],
  ["2025-05-20", "17:16", "Pharmacy essentials", "D. Watson", H, "Medicine", "Debit Card", 2340],
  ["2025-05-19", "16:45", "Coffee meeting", "Coffee Planet", F, "Outdoor Dining", "Credit Card", 1840],
  ["2025-05-18", "15:20", "New running shoes", "Servis", S, "Clothing", "Debit Card", 7450],
  ["2025-05-16", "09:12", "Internet subscription", "Nayatel", B, "Internet", "Bank Transfer", 4590],
  ["2025-05-03", "13:10", "Lunch delivery", "Foodpanda", F, "Home Delivery", "Cash", 2150],
  ["2025-05-04", "07:40", "Margalla trail day", "Margalla Trails", O, "Trips & Outings", "Cash", 6000],
  ["2025-05-09", "20:05", "Dinner out", "Kolachi", F, "Outdoor Dining", "Credit Card", 5300],
  ["2025-05-10", "18:30", "Fuel top-up", "Shell Blue Area", P, "Petrol", "Debit Card", 8300],
  ["2025-05-12", "15:45", "Daraz order", "Daraz", S, "Household", "Bank Transfer", 4660],
  ["2025-05-12", "17:20", "Pharmacy", "Clinix", H, "Medicine", "Cash", 2760],
  ["2025-05-14", "19:15", "Takeaway", "Savour Foods", F, "Takeaway", "Cash", 3600],
  ["2025-05-30", "12:50", "Office lunch", "Gloria Jean's", F, "Outdoor Dining", "Debit Card", 2990],
]

function history(): Row[] {
  let seed = 11
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
  const between = (a: number, b: number) => Math.round((a + rnd() * (b - a)) / 10) * 10
  const rows: Row[] = []
  for (const ym of ["2024-12", "2025-01", "2025-02", "2025-03", "2025-04"]) {
    const d = (n: number) => `${ym}-${pad(Math.min(n, daysIn(ym)))}`
    rows.push(
      [d(24), "10:30", "Electricity bill", "IESCO", B, "Electricity", "Bank Transfer", between(8500, 13500)],
      [d(16), "09:12", "Internet subscription", "Nayatel", B, "Internet", "Bank Transfer", 4590],
      [d(3), "18:10", "Fuel refill", "PSO F-7", P, "Petrol", "Debit Card", between(7200, 9000)],
      [d(18), "17:40", "Fuel refill", "Shell Blue Area", P, "Petrol", "Debit Card", between(6800, 8800)],
      [d(6), "13:20", "Lunch delivery", "Foodpanda", F, "Home Delivery", "Cash", between(1200, 2300)],
      [d(13), "13:05", "Lunch delivery", "Foodpanda", F, "Home Delivery", "Cash", between(1200, 2300)],
      [d(9), "20:10", "Dinner out", "The Monal", F, "Outdoor Dining", "Credit Card", between(3500, 6000)],
      [d(26), "20:30", "Dinner out", "Kolachi", F, "Outdoor Dining", "Credit Card", between(3200, 5600)],
      [d(15), "16:30", "Coffee meeting", "Coffee Planet", F, "Outdoor Dining", "Credit Card", between(1200, 2200)],
      [d(11), "14:10", "Daraz order", "Daraz", S, "Household", "Bank Transfer", between(4000, 9500)],
      [d(22), "15:30", "Clothing", "Servis", S, "Clothing", "Debit Card", between(4500, 8500)],
      [d(8), "17:00", "Pharmacy", "D. Watson", H, "Medicine", "Debit Card", between(1500, 3200)],
      [d(14), "07:30", "Weekend trip", "Trail 5", O, "Trips & Outings", "Cash", between(2500, 7000)],
    )
  }
  return rows
}

const toExpense = (r: Row, i: number): Expense => ({
  id: `seed-${i + 1}`,
  date: r[0], time: r[1], title: r[2], merchant: r[3], category: r[4], subcategory: r[5],
  payment: r[6], amount: r[7], note: r[8],
  createdAt: `${r[0]}T${r[1]}:00`, updatedAt: `${r[0]}T${r[1]}:00`,
})

export const seedExpenses = (): Expense[] => [...may, ...history()].map(toExpense)

export const seedDB = (): DB => ({
  expenses: seedExpenses(),
  categories: seedCategories,
  settings: defaultSettings,
  readNotifs: [],
  period: "2025-05",
})

export const emptyDB = (): DB => ({
  expenses: [],
  categories: seedCategories.map((c) => ({ ...c })),
  settings: { ...defaultSettings },
  readNotifs: [],
  period: currentYm(),
})
