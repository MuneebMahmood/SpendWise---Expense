import type { CurrencyCode } from "../types"

export const pad = (n: number) => String(n).padStart(2, "0")
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => toISO(new Date())
export const parseISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}
export const ymOf = (iso: string) => iso.slice(0, 7)
export const currentYm = () => todayISO().slice(0, 7)
export const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
export const daysIn = (ym: string) => {
  const [y, m] = ym.split("-").map(Number)
  return new Date(y, m, 0).getDate()
}
export const monthLabel = (ym: string, style: "long" | "short" = "long") => {
  const [y, m] = ym.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: style, year: "numeric" })
}
export const monthName = (ym: string, style: "long" | "short" = "long") => {
  const [y, m] = ym.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: style })
}
export const fmtDate = (iso: string) =>
  parseISO(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
export const fmtShort = (iso: string) =>
  parseISO(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
export const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number)
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`
}
export const nowTime = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const CURRENCIES: Record<CurrencyCode, { label: string; prefix: string; name: string }> = {
  PKR: { label: "PKR (Rs)", prefix: "Rs ", name: "Pakistani Rupee" },
  USD: { label: "USD ($)", prefix: "$", name: "US Dollar" },
  EUR: { label: "EUR (€)", prefix: "€", name: "Euro" },
  GBP: { label: "GBP (£)", prefix: "£", name: "British Pound" },
  AED: { label: "AED", prefix: "AED ", name: "UAE Dirham" },
  SAR: { label: "SAR", prefix: "SAR ", name: "Saudi Riyal" },
}

export const makeMoney = (code: CurrencyCode) => (value: number) => {
  const c = CURRENCIES[code] ?? CURRENCIES.PKR
  const sign = value < 0 ? "−" : ""
  return `${sign}${c.prefix}${Math.abs(Math.round(value)).toLocaleString("en-US")}`
}

export const fmtK = (v: number) =>
  v >= 1000 ? `${+(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${Math.round(v)}`

export const pctChange = (now: number, prev: number) =>
  prev > 0 ? ((now - prev) / prev) * 100 : null

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`

const csvCell = (v: unknown) => {
  const s = String(v ?? "")
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export const toCSV = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\n")

export const download = (filename: string, text: string, mime = "text/csv;charset=utf-8") => {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const sha256 = async (text: string) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("")
}
