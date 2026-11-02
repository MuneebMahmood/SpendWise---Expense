import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  Activity, Baby, Bike, Briefcase, CarFront, CircleDollarSign, Coffee, Dumbbell, FileBarChart, Film,
  Fuel, Gift, GraduationCap, Heart, Home, PawPrint, Plane, Search, ShoppingBag, Smartphone, Utensils, Wifi, X, Zap,
  type LucideIcon,
} from "lucide-react"
import type { Category, Receipt } from "../types"
import { useApp } from "../ctx"

export const ICONS: Record<string, LucideIcon> = {
  food: Utensils, fuel: Fuel, activity: Bike, shopping: ShoppingBag, bills: Zap, health: Activity,
  money: CircleDollarSign, car: CarFront, home: Home, report: FileBarChart, travel: Plane, education: GraduationCap,
  gift: Gift, movie: Film, coffee: Coffee, phone: Smartphone, internet: Wifi, fitness: Dumbbell, pet: PawPrint,
  kids: Baby, work: Briefcase, love: Heart, custom: CircleDollarSign,
}
export const COLORS = ["#F97316", "#2563EB", "#8B5CF6", "#DB2777", "#0891B2", "#16A34A", "#0F766E", "#D97706", "#DC2626", "#475569"]
export const tint = (color: string) => `${color}1A`

export function CatIcon({ cat, size = 18 }: { cat?: Category; size?: number }) {
  const I = (cat && ICONS[cat.icon]) || CircleDollarSign
  return <I size={size} strokeWidth={1.9} />
}

export function Button({
  children, variant = "primary", className = "", onClick, type = "button", disabled = false,
}: {
  children: ReactNode
  variant?: "primary" | "secondary" | "ghost" | "danger"
  className?: string
  onClick?: () => void
  type?: "button" | "submit"
  disabled?: boolean
}) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`btn btn-${variant} ${className}`}>
      {children}
    </button>
  )
}

export function IconButton({
  children, label, onClick, className = "",
}: { children: ReactNode; label: string; onClick?: () => void; className?: string }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  )
}

export function CategoryBadge({ name, categories }: { name: string; categories: Category[] }) {
  const cat = categories.find((c) => c.name === name)
  return (
    <span className="category-badge">
      <span className="category-mini-icon" style={{ background: cat ? tint(cat.color) : "#f1f5f9", color: cat?.color ?? "#64748b" }}>
        <CatIcon cat={cat} size={15} />
      </span>
      {name}
    </span>
  )
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span><Search size={22} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  )
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o} type="button" className={o === value ? "active" : ""} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle ${on ? "on" : ""}`} onClick={() => onChange(!on)}>
      <i />
    </button>
  )
}

/** Closes on Escape. */
export function useEscape(fn: () => void) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && ref.current()
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [])
}

export function SimpleDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEscape(onClose)
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="simple-dialog" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <h2>{title}</h2>
          <IconButton label="Close" onClick={onClose}><X size={20} /></IconButton>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Small dropdown anchored to its trigger; closes on outside click / Escape. */
export function Popover({
  trigger, children, align = "right", className = "",
}: {
  trigger: (o: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: "left" | "right"
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", down)
    document.addEventListener("keydown", key)
    return () => {
      document.removeEventListener("mousedown", down)
      document.removeEventListener("keydown", key)
    }
  }, [open])
  return (
    <div className="popover-wrap" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && <div className={`menu ${align === "left" ? "menu-left" : ""} ${className}`}>{children(() => setOpen(false))}</div>}
    </div>
  )
}

export const MenuItem = ({ children, onClick, danger = false }: { children: ReactNode; onClick: () => void; danger?: boolean }) => (
  <button type="button" className={`menu-item ${danger ? "danger" : ""}`} onClick={onClick}>{children}</button>
)

/** Read a user-picked image / PDF into a compact data URL for local storage. */
export function readReceipt(file: File, maxEdge = 1200): Promise<{ name: string; type: string; data: string }> {
  return new Promise((resolve, reject) => {
    const isImg = file.type.startsWith("image/")
    if (!isImg && file.type !== "application/pdf") return reject(new Error("Please choose a PNG, JPG or PDF file."))
    if (file.size > 10 * 1024 * 1024) return reject(new Error("File is larger than 10 MB."))
    if (!isImg && file.size > 1.2 * 1024 * 1024) return reject(new Error("PDFs must be under 1.2 MB to be stored in your browser."))
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Could not read that file."))
    reader.onload = () => {
      const src = String(reader.result)
      if (!isImg) return resolve({ name: file.name, type: file.type, data: src })
      const img = new Image()
      img.onerror = () => reject(new Error("Could not read that image."))
      img.onload = () => {
        const k = Math.min(1, maxEdge / Math.max(img.width, img.height))
        const c = document.createElement("canvas")
        c.width = Math.round(img.width * k)
        c.height = Math.round(img.height * k)
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height)
        resolve({ name: file.name, type: "image/jpeg", data: c.toDataURL("image/jpeg", 0.82) })
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  })
}

/** Resolves a receipt to something an <img>/<a> can load (local data URL, or a short-lived signed URL). */
export function useReceiptUrl(r?: Receipt) {
  const { receiptUrl } = useApp()
  const [url, setUrl] = useState<string | undefined>(r?.data)
  useEffect(() => {
    if (!r) return setUrl(undefined)
    if (r.data) return setUrl(r.data)
    if (!r.path) return setUrl(undefined)
    let alive = true
    receiptUrl(r.path).then((u) => alive && setUrl(u)).catch(() => alive && setUrl(undefined))
    return () => { alive = false }
  }, [r?.data, r?.path])
  return url
}
