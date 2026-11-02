import { useRef, useState, type FormEvent } from "react"
import { CalendarDays, ChevronRight, CircleDollarSign, Download, KeyRound, Landmark, LogOut, Plus, Trash2, Upload, WalletCards, X } from "lucide-react"
import { useApp } from "../ctx"
import { Avatar } from "../components/Avatar"
import { Button, CatIcon, SectionHeader, SimpleDialog, tint, Toggle } from "../components/ui"
import { auth } from "../lib/backend"
import { CURRENCIES, download, fmtDate, fmtTime, sha256, toCSV } from "../lib/format"
import type { CurrencyCode, RangeKey } from "../types"

const TABS = ["Account", "Preferences", "Categories", "Budgets & alerts", "Data & exports", "Security", "Connected accounts"] as const
type Tab = (typeof TABS)[number]
const RANGES: RangeKey[] = ["This month", "Last 30 days", "This year", "All time"]

function photoToDataURL(file: File, size = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Please choose an image file."))
    const r = new FileReader()
    r.onload = () => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement("canvas")
        c.width = c.height = size
        const k = Math.max(size / img.width, size / img.height)
        const w = img.width * k, h = img.height * k
        c.getContext("2d")!.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        resolve(c.toDataURL("image/jpeg", 0.85))
      }
      img.onerror = () => reject(new Error("Could not read that image."))
      img.src = String(r.result)
    }
    r.onerror = () => reject(new Error("Could not read that file."))
    r.readAsDataURL(file)
  })
}

function ProfileDialog({ onClose }: { onClose: () => void }) {
  const { db, updateSettings, toast } = useApp()
  const [name, setName] = useState(db.settings.name)
  const { user } = useApp()
  const [photo, setPhoto] = useState(db.settings.photo)
  const [tried, setTried] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const save = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!name.trim()) return
    updateSettings({ name: name.trim(), photo })
    toast("Profile updated")
    onClose()
  }
  return (
    <SimpleDialog title="Profile information" onClose={onClose}>
      <form onSubmit={save} noValidate style={{ display: "contents" }}>
        <div className="profile-edit" style={{ margin: "18px 22px 14px" }}>
          <Avatar large name={name} photo={photo} />
          <div>
            <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = ""
              if (f) try { setPhoto(await photoToDataURL(f)) } catch (err) { toast("Couldn't use that photo", { sub: (err as Error).message }) }
            }} />
            <Button variant="secondary" onClick={() => file.current?.click()}>Change photo</Button>
            {photo && <button type="button" className="text-action" style={{ marginLeft: 10 }} onClick={() => setPhoto(undefined)}>Remove</button>}
          </div>
        </div>
        <label className="form-field"><span>Full name</span><input value={name} onChange={(e) => setName(e.target.value)} />{tried && !name.trim() && <em className="field-error">Name is required.</em>}</label>
        <label className="form-field"><span>Email <i>Your sign-in email</i></span><input value={user.email} disabled readOnly /></label>
        <div className="dialog-actions"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save profile</Button></div>
      </form>
    </SimpleDialog>
  )
}

function PinDialog({ mode, onClose }: { mode: "set" | "remove"; onClose: () => void }) {
  const { db, updateSettings, toast } = useApp()
  const has = !!db.settings.pinHash
  const [cur, setCur] = useState("")
  const [pin, setPin] = useState("")
  const [again, setAgain] = useState("")
  const [err, setErr] = useState("")
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (has && (await sha256(cur)) !== db.settings.pinHash) return setErr("Current PIN is incorrect.")
    if (mode === "remove") { updateSettings({ pinHash: undefined }); toast("App lock removed"); return onClose() }
    if (pin.length < 4) return setErr("PIN must be 4–6 digits.")
    if (pin !== again) return setErr("PINs don't match.")
    updateSettings({ pinHash: await sha256(pin) })
    sessionStorage.setItem("spendwise:unlocked", "1")
    toast("App lock enabled", { sub: "You'll be asked for your PIN when you open SpendWise." })
    onClose()
  }
  return (
    <SimpleDialog title={mode === "remove" ? "Remove app lock" : has ? "Change PIN" : "Set a PIN"} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "contents" }}>
        <p className="dialog-intro">The PIN is stored only on this device as a one-way hash. It locks the app screen; it doesn't encrypt your data.</p>
        {has && <label className="form-field"><span>Current PIN</span><input type="password" inputMode="numeric" autoFocus value={cur} onChange={(e) => { setCur(digits(e.target.value)); setErr("") }} /></label>}
        {mode === "set" && (
          <>
            <label className="form-field"><span>New PIN</span><input type="password" inputMode="numeric" value={pin} onChange={(e) => { setPin(digits(e.target.value)); setErr("") }} /></label>
            <label className="form-field"><span>Confirm PIN</span><input type="password" inputMode="numeric" value={again} onChange={(e) => { setAgain(digits(e.target.value)); setErr("") }} /></label>
          </>
        )}
        {err && <em className="field-error" style={{ display: "block", marginBottom: 12 }}>{err}</em>}
        <div className="dialog-actions"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant={mode === "remove" ? "danger" : "primary"}>{mode === "remove" ? "Remove lock" : "Save PIN"}</Button></div>
      </form>
    </SimpleDialog>
  )
}

function PasswordDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useApp()
  const [a, setA] = useState("")
  const [b, setB] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (a.length < 8) return setErr("Password must be at least 8 characters.")
    if (a !== b) return setErr("Passwords don't match.")
    setBusy(true)
    try { await auth.updatePassword(a); toast("Password updated"); onClose() } catch (er) { setErr((er as Error).message); setBusy(false) }
  }
  return (
    <SimpleDialog title="Change password" onClose={onClose}>
      <form onSubmit={submit} style={{ display: "contents" }}>
        <label className="form-field" style={{ marginTop: 18 }}><span>New password</span><input type="password" autoFocus autoComplete="new-password" value={a} onChange={(e) => { setA(e.target.value); setErr("") }} /></label>
        <label className="form-field"><span>Confirm new password</span><input type="password" autoComplete="new-password" value={b} onChange={(e) => { setB(e.target.value); setErr("") }} /></label>
        {err && <em className="field-error" style={{ display: "block", marginBottom: 12 }}>{err}</em>}
        <div className="dialog-actions"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>Update password</Button></div>
      </form>
    </SimpleDialog>
  )
}

export default function SettingsPage() {
  const { db, money, updateSettings, openCategory, askDeleteCategory, confirm, toast, importDB, loadSample, importLegacy, hasLegacy, clearAll, setPage, signOut } = useApp()
  const [tab, setTab] = useState<Tab>("Account")
  const [pw, setPw] = useState(false)
  const [legacy, setLegacy] = useState(() => hasLegacy())
  const [profile, setProfile] = useState(false)
  const [pin, setPin] = useState<null | "set" | "remove">(null)
  const [newMethod, setNewMethod] = useState("")
  const restore = useRef<HTMLInputElement>(null)
  const st = db.settings
  const setNotify = (k: keyof typeof st.notify) => (v: boolean) => updateSettings({ notify: { ...st.notify, [k]: v } })

  const currencySelect = (
    <select value={st.currency} onChange={(e) => { updateSettings({ currency: e.target.value as CurrencyCode }); toast("Currency updated", { sub: CURRENCIES[e.target.value as CurrencyCode].name }) }}>
      {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => <option key={c} value={c}>{CURRENCIES[c].label}</option>)}
    </select>
  )
  const rangeSelect = (
    <select value={st.defaultRange} onChange={(e) => updateSettings({ defaultRange: e.target.value as RangeKey })}>
      {RANGES.map((r) => <option key={r}>{r}</option>)}
    </select>
  )

  const exportAll = () => {
    download(`spendwise-all-expenses.csv`, toCSV([
      ["Date", "Time", "Title", "Merchant", "Category", "Subcategory", "Payment method", "Amount", "Notes"],
      ...db.expenses.map((e) => [fmtDate(e.date), fmtTime(e.time), e.title, e.merchant, e.category, e.subcategory, e.payment, e.amount, e.note ?? ""]),
    ]))
    toast("Export ready", { sub: `${db.expenses.length} expenses saved as CSV.` })
  }
  const backup = () => {
    download(`spendwise-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ ...db, settings: { ...db.settings, pinHash: undefined } }, null, 2), "application/json")
    toast("Backup downloaded")
  }
  const onRestore = async (f?: File) => {
    if (!f) return
    try {
      const raw = JSON.parse(await f.text())
      if (!Array.isArray(raw.expenses) || !Array.isArray(raw.categories)) throw new Error("This doesn't look like a SpendWise backup.")
      confirm({ title: "Restore this backup?", text: `This replaces your current data with ${raw.expenses.length} expenses and ${raw.categories.length} categories from the file.`, confirmLabel: "Restore backup", onConfirm: async () => { try { const n = await importDB(raw); toast("Backup restored", { sub: `${n} expenses imported.` }) } catch (e) { toast("Restore failed", { sub: (e as Error).message }) } } })
    } catch (err) { toast("Couldn't restore backup", { sub: (err as Error).message }) }
  }

  const sections: Record<Tab, React.ReactNode> = {
    Account: (
      <>
        <section className="panel profile-settings">
          <SectionHeader title="Your profile" subtitle="This information appears on your SpendWise account." />
          <div className="profile-edit">
            <Avatar large name={st.name} photo={st.photo} />
            <div><strong>{st.name}</strong><p>{st.email}</p></div>
            <Button variant="secondary" onClick={() => setProfile(true)}>Edit profile</Button>
          </div>
        </section>
        <section className="panel settings-list">
          <SectionHeader title="General preferences" />
          <button onClick={() => setProfile(true)}><span><Landmark /></span><div><strong>Profile information</strong><small>Update your name, photo and contact details</small></div><i>{st.name}</i><ChevronRight size={17} /></button>
          <button onClick={() => setTab("Preferences")}><span><CircleDollarSign /></span><div><strong>Currency & formatting</strong><small>Choose currency and number display preferences</small></div><i>{CURRENCIES[st.currency].label}</i><ChevronRight size={17} /></button>
          <button onClick={() => setTab("Preferences")}><span><CalendarDays /></span><div><strong>Default date range</strong><small>Set the period shown when you open All Expenses</small></div><i>{st.defaultRange}</i><ChevronRight size={17} /></button>
          <button onClick={() => setTab("Categories")}><span><WalletCards /></span><div><strong>Category preferences</strong><small>Manage default categories and custom fields</small></div><i>{db.categories.length} categories</i><ChevronRight size={17} /></button>
        </section>
        <NotificationSection />
      </>
    ),
    Preferences: (
      <section className="panel pref-panel">
        <SectionHeader title="Preferences" subtitle="Applied everywhere in SpendWise." />
        <label className="form-field"><span>Currency</span>{currencySelect}</label>
        <label className="form-field"><span>Default date range (All Expenses)</span>{rangeSelect}</label>
        <p className="hint">Amounts are only formatted in the chosen currency — existing values aren't converted.</p>
      </section>
    ),
    Categories: (
      <section className="panel">
        <SectionHeader title="Categories" subtitle="Rename, recolour, set budgets or remove categories." action={<Button onClick={() => openCategory(null)}><Plus size={16} /> New</Button>} />
        <div className="cat-list">
          {db.categories.map((c) => (
            <div key={c.id}>
              <span className="category-mini-icon" style={{ background: tint(c.color), color: c.color }}><CatIcon cat={c} size={16} /></span>
              <strong>{c.name}</strong><small>{c.budget ? `Budget ${money(c.budget)}` : "No budget"}</small>
              <Button variant="secondary" onClick={() => openCategory(c)}>Edit</Button>
              <button className="icon-btn" aria-label={`Delete ${c.name}`} onClick={() => askDeleteCategory(c)}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </section>
    ),
    "Budgets & alerts": (
      <>
        <section className="panel pref-panel">
          <SectionHeader title="Budget limits" subtitle="Your overall monthly spending limit." />
          <div className="inline-row"><strong>{money(st.overallBudget)}</strong><Button variant="secondary" onClick={() => setPage("Monthly Budgets")}>Manage budgets</Button></div>
          <label className="form-field" style={{ marginTop: 14 }}><span>Alert when usage reaches</span>
            <select value={st.alertThreshold} onChange={(e) => updateSettings({ alertThreshold: Number(e.target.value) })}>
              {[70, 80, 90].map((n) => <option key={n} value={n}>{n}% of budget</option>)}
            </select>
          </label>
        </section>
        <NotificationSection />
      </>
    ),
    "Data & exports": (
      <section className="panel data-panel">
        <SectionHeader title="Data & exports" subtitle="Your data is stored securely in your SpendWise account." />
        <div className="data-row"><span><strong>Export expenses (CSV)</strong><small>All {db.expenses.length} transactions, ready for Excel or Sheets</small></span><Button variant="secondary" onClick={exportAll}><Download size={16} /> Export</Button></div>
        <div className="data-row"><span><strong>Download backup (JSON)</strong><small>Expenses, categories, budgets and settings</small></span><Button variant="secondary" onClick={backup}><Download size={16} /> Backup</Button></div>
        <div className="data-row"><span><strong>Restore from backup</strong><small>Replace current data with a SpendWise backup file</small></span>
          <input ref={restore} type="file" accept="application/json,.json" hidden onChange={(e) => { onRestore(e.target.files?.[0]); e.target.value = "" }} />
          <Button variant="secondary" onClick={() => restore.current?.click()}><Upload size={16} /> Restore</Button></div>
        {legacy && <div className="data-row"><span><strong>Import data saved in this browser</strong><small>Found expenses from the earlier offline version — copy them into your account</small></span>
          <Button variant="secondary" onClick={() => confirm({ title: "Import browser data?", text: "Expenses saved by the earlier offline version of SpendWise will be added to your account.", confirmLabel: "Import", onConfirm: async () => { try { const n = await importLegacy(); localStorage.removeItem("spendwise:v1"); setLegacy(false); toast("Import complete", { sub: `${n} expenses added.` }) } catch (e) { toast("Import failed", { sub: (e as Error).message }) } } })}><Upload size={16} /> Import</Button></div>}
        <div className="data-row"><span><strong>Load sample data</strong><small>Replace your expenses with the demo data set</small></span>
          <Button variant="secondary" onClick={() => confirm({ title: "Load sample data?", text: "Your current expenses and categories will be replaced by demo data.", confirmLabel: "Load sample data", onConfirm: async () => { try { const n = await loadSample(); toast("Sample data loaded", { sub: `${n} expenses added.` }) } catch (e) { toast("Couldn't load sample data", { sub: (e as Error).message }) } } })}>Load</Button></div>
        <div className="data-row"><span><strong>Delete all expenses</strong><small>Keeps your categories, budgets and settings</small></span>
          <Button variant="danger" onClick={() => confirm({ title: "Delete all expenses?", text: `All ${db.expenses.length} expenses will be permanently removed from this browser. Download a backup first if you may need them.`, confirmLabel: "Delete everything", danger: true, onConfirm: () => { clearAll(); toast("All expenses deleted") } })}><Trash2 size={16} /> Delete</Button></div>
      </section>
    ),
    Security: (
      <section className="panel data-panel">
        <SectionHeader title="Security" subtitle="Protect your account and this device." />
        <div className="data-row"><span><strong>App lock (PIN)</strong><small>{st.pinHash ? "Enabled — asked each time you open the app" : "Require a 4–6 digit PIN when opening the app"}</small></span>
          <span className="btn-group">
            <Button variant="secondary" onClick={() => setPin("set")}><KeyRound size={16} /> {st.pinHash ? "Change PIN" : "Set PIN"}</Button>
            {st.pinHash && <Button variant="danger" onClick={() => setPin("remove")}>Remove</Button>}
          </span></div>
        <div className="data-row"><span><strong>Account password</strong><small>Change the password you use to sign in</small></span><Button variant="secondary" onClick={() => setPw(true)}><KeyRound size={16} /> Change password</Button></div>
        <div className="data-row"><span><strong>Sign out</strong><small>Sign out of SpendWise on this device</small></span><Button variant="secondary" onClick={signOut}><LogOut size={16} /> Sign out</Button></div>
        {st.pinHash && <div className="data-row"><span><strong>Lock now</strong><small>Return to the PIN screen immediately</small></span><Button variant="secondary" onClick={() => { sessionStorage.removeItem("spendwise:unlocked"); location.reload() }}>Lock</Button></div>}
      </section>
    ),
    "Connected accounts": (
      <section className="panel">
        <SectionHeader title="Payment accounts" subtitle="Methods you can pick when recording an expense. Automatic bank sync isn't available in the local version." />
        <div className="cat-list">
          {st.paymentMethods.map((m) => (
            <div key={m}><span className="category-mini-icon" style={{ background: "#f1f5f9", color: "#64748b" }}><WalletCards size={16} /></span><strong>{m}</strong><small>{db.expenses.filter((e) => e.payment === m).length} expenses</small>
              <span />
              <button className="icon-btn" aria-label={`Remove ${m}`} disabled={st.paymentMethods.length <= 1} onClick={() => updateSettings({ paymentMethods: st.paymentMethods.filter((x) => x !== m) })}><X size={16} /></button></div>
          ))}
        </div>
        <form className="inline-row" style={{ marginTop: 14 }} onSubmit={(e) => {
          e.preventDefault()
          const v = newMethod.trim()
          if (!v) return
          if (st.paymentMethods.some((m) => m.toLowerCase() === v.toLowerCase())) return toast("Already added", { sub: v })
          updateSettings({ paymentMethods: [...st.paymentMethods, v] }); setNewMethod("")
        }}>
          <input className="plain-input" value={newMethod} onChange={(e) => setNewMethod(e.target.value)} placeholder="e.g. Easypaisa, JazzCash" />
          <Button type="submit"><Plus size={16} /> Add</Button>
        </form>
      </section>
    ),
  }

  function NotificationSection() {
    return (
      <section className="panel notification-settings">
        <SectionHeader title="Notifications & alerts" subtitle="Choose what appears in the bell menu." />
        <div><span><strong>Budget limit alerts</strong><small>Get notified when a category reaches {st.alertThreshold}% of its budget.</small></span><Toggle on={st.notify.budget} onChange={setNotify("budget")} label="Budget limit alerts" /></div>
        <div><span><strong>Weekly spending summary</strong><small>A concise summary of the last 7 days.</small></span><Toggle on={st.notify.weekly} onChange={setNotify("weekly")} label="Weekly spending summary" /></div>
        <div><span><strong>Unusual spending activity</strong><small>Alerts for expenses that differ from your normal patterns.</small></span><Toggle on={st.notify.unusual} onChange={setNotify("unusual")} label="Unusual spending activity" /></div>
      </section>
    )
  }

  const groups: [string, Tab[]][] = [["GENERAL", ["Account", "Preferences", "Categories"]], ["FINANCES", ["Budgets & alerts", "Data & exports"]], ["SECURITY", ["Security", "Connected accounts"]]]
  return (
    <div className="page settings-page">
      <div className="page-heading"><div><h1>Settings</h1><p>Personalize SpendWise to match how you manage money.</p></div></div>
      <div className="mobile-tabs">{TABS.map((t) => <button key={t} className={t === tab ? "active" : ""} onClick={() => setTab(t)}>{t}</button>)}</div>
      <div className="settings-layout">
        <aside className="settings-nav">
          {groups.map(([g, items]) => (
            <div key={g} style={{ display: "contents" }}>
              <strong>{g}</strong>
              {items.map((t) => <button key={t} className={t === tab ? "active" : ""} onClick={() => setTab(t)}>{t}</button>)}
            </div>
          ))}
        </aside>
        <main className="settings-content">{sections[tab]}</main>
      </div>
      {profile && <ProfileDialog onClose={() => setProfile(false)} />}
      {pin && <PinDialog mode={pin} onClose={() => setPin(null)} />}
      {pw && <PasswordDialog onClose={() => setPw(false)} />}
    </div>
  )
}
