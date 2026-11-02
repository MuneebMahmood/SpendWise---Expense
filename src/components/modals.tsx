import { useRef, useState, type FormEvent } from "react"
import { Bike, Check, ChevronDown, CreditCard, Fuel, Plus, Receipt, Trash2, Utensils, X, Paperclip } from "lucide-react"
import { useApp } from "../ctx"
import type { Category, Expense } from "../types"
import { blankExpense } from "../lib/store"
import { fmtDate, fmtTime, monthLabel } from "../lib/format"
import { sum } from "../lib/stats"
import { Button, CatIcon, CategoryBadge, COLORS, ICONS, IconButton, readReceipt, SimpleDialog, tint, useEscape, useReceiptUrl } from "./ui"

const SUBTYPES: Record<string, { label: string; options: string[]; merchant: string; placeholder: string }> = {
  food: { label: "Order type", options: ["Outdoor Dining", "Home Delivery", "Takeaway"], merchant: "Restaurant", placeholder: "e.g. Monal" },
  fuel: { label: "Fuel type", options: ["Petrol", "Diesel", "Other"], merchant: "Station", placeholder: "e.g. PSO F-7" },
  activity: { label: "Activity type", options: ["Recreation", "Events & Social", "Trips & Outings"], merchant: "Venue", placeholder: "Location" },
}

export function ExpenseModal({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const { db, money, period, addExpense, updateExpense, openCategory, toast } = useApp()
  const { categories } = db
  const editing = !!expense
  const blank = blankExpense(period)
  const [category, setCategory] = useState(expense?.category ?? categories[0]?.name ?? "")
  const [title, setTitle] = useState(expense?.title ?? "")
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "")
  const [date, setDate] = useState(expense?.date ?? blank.date)
  const [time, setTime] = useState(expense?.time ?? blank.time)
  const [payment, setPayment] = useState(expense?.payment ?? db.settings.paymentMethods[1] ?? db.settings.paymentMethods[0] ?? "Cash")
  const [subcategory, setSubcategory] = useState(expense?.subcategory ?? "")
  const [merchant, setMerchant] = useState(expense && expense.merchant !== expense.title ? expense.merchant : "")
  const [qty, setQty] = useState("")
  const [odo, setOdo] = useState("")
  const [note, setNote] = useState(expense?.note ?? "")
  const [receipt, setReceipt] = useState(expense?.receipt)
  const [advanced, setAdvanced] = useState(!!(expense?.note || expense?.receipt))
  const [tried, setTried] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const receiptSrc = useReceiptUrl(receipt)
  useEscape(onClose)

  const selected = categories.find((c) => c.name === category) ?? categories[0]
  const kind = SUBTYPES[selected?.icon ?? ""]
  const amt = Number(amount)
  const errors = {
    amount: !(amt > 0) ? "Enter an amount greater than zero." : "",
    title: !title.trim() ? "Give this expense a title." : "",
    category: !selected ? "Create a category first." : "",
    date: !date ? "Pick a date." : "",
  }
  const invalid = Object.values(errors).some(Boolean)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (invalid || !selected) return
    const parts = [qty && `${qty} litres`, odo && `Odometer ${odo} km`, note.trim()].filter(Boolean) as string[]
    const data = {
      title: title.trim(),
      merchant: merchant.trim() || title.trim(),
      category: selected.name,
      subcategory: subcategory || kind?.options[0] || "General",
      payment, amount: amt, date, time: time || "12:00",
      note: parts.join(" · ") || undefined,
      receipt,
    }
    if (editing && expense) updateExpense(expense.id, data)
    else addExpense(data)
    toast(editing ? "Expense updated" : "Expense saved", { sub: `${title.trim()} · ${money(amt)}` })
    onClose()
  }

  const pickFile = async (f?: File) => {
    if (!f) return
    try {
      setReceipt(await readReceipt(f))
    } catch (err) {
      toast("Couldn't attach receipt", { sub: (err as Error).message })
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="expense-modal" onSubmit={submit} noValidate onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <div>
            <h2>{editing ? "Edit expense" : "Add a new expense"}</h2>
            <p>{editing ? "Update the details of this transaction." : "Record a transaction in just a few seconds."}</p>
          </div>
          <IconButton label="Close" onClick={onClose}><X size={21} /></IconButton>
        </div>
        <div className="expense-form-scroll">
          <label className="amount-field">
            <span>AMOUNT</span>
            <div>
              <b>{money(0).replace(/0$/, "").trim()}</b>
              <input autoFocus inputMode="decimal" value={amount} placeholder="0.00"
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"))} />
            </div>
            <small>{tried && errors.amount ? <span className="field-error">{errors.amount}</span> : "Enter the total you paid"}</small>
          </label>
          <label className="form-field">
            <span>Expense title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What did you spend on?" />
            {tried && errors.title && <em className="field-error">{errors.title}</em>}
          </label>
          <div className="form-field">
            <span>Category</span>
            <div className="visual-categories">
              {categories.map((c) => (
                <button type="button" key={c.id} className={category === c.name ? "selected" : ""}
                  onClick={() => { setCategory(c.name); setSubcategory("") }}>
                  <span style={{ color: c.color, background: tint(c.color) }}><CatIcon cat={c} size={19} /></span>
                  <small>{c.name.replace(" & ", " &\n")}</small>
                  {category === c.name && <i><Check size={11} /></i>}
                </button>
              ))}
              <button type="button" onClick={() => { onClose(); openCategory(null) }}>
                <span><Plus size={19} /></span>
                <small>New category</small>
              </button>
            </div>
            {tried && errors.category && <em className="field-error">{errors.category}</em>}
          </div>
          <div className="form-row">
            <label className="form-field">
              <span>Date</span>
              <input type="date" className="plain-input" value={date} onChange={(e) => setDate(e.target.value)} />
              {tried && errors.date && <em className="field-error">{errors.date}</em>}
            </label>
            <label className="form-field">
              <span>Time</span>
              <input type="time" className="plain-input" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
          <label className="form-field">
            <span>Payment method</span>
            <select value={payment} onChange={(e) => setPayment(e.target.value)}>
              {Array.from(new Set([...db.settings.paymentMethods, payment])).map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          {selected && (
            <div className="dynamic-fields">
              <span>
                {selected.icon === "food" ? <Utensils size={16} /> : selected.icon === "fuel" ? <Fuel size={16} /> : selected.icon === "activity" ? <Bike size={16} /> : <CatIcon cat={selected} size={16} />}
                {selected.name} details
              </span>
              <div className="form-row">
                {kind ? (
                  <label className="form-field">
                    <span>{kind.label}</span>
                    <select value={subcategory || kind.options[0]} onChange={(e) => setSubcategory(e.target.value)}>
                      {Array.from(new Set([...kind.options, subcategory].filter(Boolean))).map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </label>
                ) : (
                  <label className="form-field">
                    <span>Subcategory <i>Optional</i></span>
                    <input value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="e.g. General" />
                  </label>
                )}
                <label className="form-field">
                  <span>{kind?.merchant ?? "Merchant"} <i>Optional</i></span>
                  <input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder={kind?.placeholder ?? "Where did you pay?"} />
                </label>
              </div>
              {selected.icon === "fuel" && (
                <div className="form-row">
                  <label className="form-field">
                    <span>Quantity <i>Optional</i></span>
                    <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Litres" />
                  </label>
                  <label className="form-field">
                    <span>Odometer <i>Optional</i></span>
                    <input inputMode="numeric" value={odo} onChange={(e) => setOdo(e.target.value.replace(/[^\d]/g, ""))} placeholder="km" />
                  </label>
                </div>
              )}
            </div>
          )}
          <button type="button" className="advanced-toggle" onClick={() => setAdvanced(!advanced)}>
            <span><Plus size={15} /> Add notes or receipt</span>
            <ChevronDown size={16} className={advanced ? "rotated" : ""} />
          </button>
          {advanced && (
            <div className="advanced-fields">
              <label className="form-field">
                <span>Notes</span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a short description..." />
              </label>
              <input ref={file} type="file" accept="image/png,image/jpeg,application/pdf" hidden
                onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = "" }} />
              {receipt ? (
                <div className="receipt-attached">
                  {receipt.type.startsWith("image/") && receiptSrc ? <img src={receiptSrc} alt="Receipt" /> : <Paperclip size={18} />}
                  <span><strong>{receipt.name}</strong><small>Attached</small></span>
                  <IconButton label="Remove receipt" onClick={() => setReceipt(undefined)}><Trash2 size={16} /></IconButton>
                </div>
              ) : (
                <button type="button" className="receipt-upload" onClick={() => file.current?.click()}>
                  <Receipt size={20} />
                  <span><strong>Upload receipt</strong><small>PNG, JPG or PDF · Max 10MB</small></span>
                </button>
              )}
            </div>
          )}
        </div>
        <div className="modal-actions">
          <div>
            <span className="selected-category-dot" style={{ background: selected?.color }} />
            {selected?.name ?? "No category"} selected
          </div>
          <span>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit">{editing ? "Save changes" : "Save Expense"}</Button>
          </span>
        </div>
      </form>
    </div>
  )
}

export function CategoryModal({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const { db, saveCategory, askDeleteCategory, toast } = useApp()
  const [name, setName] = useState(category?.name ?? "")
  const [icon, setIcon] = useState(category?.icon ?? "money")
  const [color, setColor] = useState(category?.color ?? COLORS[6])
  const [budget, setBudget] = useState(category?.budget ? String(category.budget) : "")
  const [tried, setTried] = useState(false)
  const trimmed = name.trim()
  const dup = db.categories.some((c) => c.id !== category?.id && c.name.toLowerCase() === trimmed.toLowerCase())
  const error = !trimmed ? "Enter a category name." : dup ? "A category with this name already exists." : ""
  const save = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (error) return
    saveCategory({ id: category?.id, name: trimmed, icon, color, budget: Number(budget) > 0 ? Number(budget) : undefined })
    toast(category ? "Category updated" : "Category created", { sub: trimmed })
    onClose()
  }
  const choices = Object.keys(ICONS).filter((k) => k !== "custom" && k !== "report")
  return (
    <SimpleDialog title={category ? "Edit category" : "Create new category"} onClose={onClose}>
      <form onSubmit={save} noValidate style={{ display: "contents" }}>
        <p className="dialog-intro">
          {category ? "Changes apply to every expense, budget and report using this category."
            : "Create a category that will be available across expenses, budgets and reports."}
        </p>
        <label className="form-field">
          <span>Category name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Education" />
          {tried && error && <em className="field-error">{error}</em>}
        </label>
        <div className="form-field">
          <span>Choose an icon</span>
          <div className="icon-picker wrap">
            {choices.map((k) => {
              const I = ICONS[k]
              return <button type="button" key={k} title={k} className={icon === k ? "selected" : ""} onClick={() => setIcon(k)}><I size={19} /></button>
            })}
          </div>
        </div>
        <div className="form-field">
          <span>Colour</span>
          <div className="color-picker">
            {COLORS.map((c) => (
              <button type="button" key={c} aria-label={c} className={color === c ? "selected" : ""} style={{ background: c }} onClick={() => setColor(c)}>
                {color === c && <Check size={13} />}
              </button>
            ))}
          </div>
        </div>
        <label className="form-field">
          <span>Monthly budget <i>Optional</i></span>
          <div className="amount-input compact">
            <span>{db.settings.currency}</span>
            <input inputMode="numeric" placeholder="0" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))} />
          </div>
        </label>
        <div className="dialog-actions">
          {category && (
            <Button variant="danger" className="push-left" onClick={() => { onClose(); askDeleteCategory(category) }}>
              <Trash2 size={16} /> Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">{category ? "Save changes" : "Create category"}</Button>
        </div>
      </form>
    </SimpleDialog>
  )
}

export function DeleteCategoryDialog({ category, onClose }: { category: Category; onClose: () => void }) {
  const { db, deleteCategory, toast } = useApp()
  const used = db.expenses.filter((e) => e.category === category.name)
  const others = db.categories.filter((c) => c.id !== category.id)
  const [target, setTarget] = useState(others[0]?.name ?? "")
  const blocked = used.length > 0 && others.length === 0
  return (
    <SimpleDialog title={`Delete “${category.name}”?`} onClose={onClose}>
      <p className="dialog-intro">
        {used.length === 0 ? "No expenses use this category. It will be removed along with its budget."
          : blocked ? "This is your only category. Create another one before deleting it."
            : `${used.length} expense${used.length > 1 ? "s" : ""} (${sum(used).toLocaleString("en-US")} total) use this category. Choose where they should move.`}
      </p>
      {used.length > 0 && !blocked && (
        <label className="form-field">
          <span>Move expenses to</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            {others.map((c) => <option key={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
      <div className="dialog-actions">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={blocked} onClick={() => { deleteCategory(category.id, used.length ? target : undefined); toast("Category deleted", { sub: category.name }); onClose() }}>
          Delete category
        </Button>
      </div>
    </SimpleDialog>
  )
}

export function BudgetDialog({ target, onClose }: { target: string; onClose: () => void }) {
  const { db, money, updateSettings, setCategoryBudget, toast, period } = useApp()
  const overall = target === "overall"
  const cat = db.categories.find((c) => c.id === target)
  const free = db.categories.filter((c) => !c.budget)
  const [pick, setPick] = useState(cat?.id ?? free[0]?.id ?? db.categories[0]?.id ?? "")
  const current = overall ? db.settings.overallBudget : db.categories.find((c) => c.id === pick)?.budget
  const [amount, setAmount] = useState(current ? String(current) : "")
  const [tried, setTried] = useState(false)
  const n = Number(amount)
  const save = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!(n > 0)) return
    if (overall) updateSettings({ overallBudget: n })
    else setCategoryBudget(pick, n)
    toast("Budget saved", { sub: `${overall ? "Monthly budget" : db.categories.find((c) => c.id === pick)?.name} · ${money(n)}` })
    onClose()
  }
  const title = overall ? "Edit monthly budget" : target === "new" ? "Add category budget" : `Edit ${cat?.name} budget`
  return (
    <SimpleDialog title={title} onClose={onClose}>
      <form onSubmit={save} noValidate style={{ display: "contents" }}>
        <p className="dialog-intro" style={{ marginBottom: 14 }}>
          {overall ? `Your overall limit for ${monthLabel(period)} and every month after it.` : "Budgets apply to every month. You'll get alerts as spending nears the limit."}
        </p>
        {target === "new" && (
          <label className="form-field">
            <span>Category</span>
            <select value={pick} onChange={(e) => { setPick(e.target.value); const b = db.categories.find((c) => c.id === e.target.value)?.budget; setAmount(b ? String(b) : "") }}>
              {db.categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.budget ? " (has budget)" : ""}</option>)}
            </select>
          </label>
        )}
        <label className="form-field">
          <span>Monthly budget limit</span>
          <div className="amount-input compact">
            <span>{db.settings.currency}</span>
            <input autoFocus inputMode="numeric" value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} />
          </div>
          {tried && !(n > 0) && <em className="field-error">Enter an amount greater than zero.</em>}
        </label>
        <div className="dialog-actions">
          {!overall && cat?.budget && (
            <Button variant="danger" className="push-left" onClick={() => { setCategoryBudget(cat.id, undefined); toast("Budget removed", { sub: cat.name }); onClose() }}>Remove</Button>
          )}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={target === "new" && db.categories.length === 0}>Save budget</Button>
        </div>
      </form>
    </SimpleDialog>
  )
}

export function ConfirmDialog({ title, text, confirmLabel, danger, onConfirm, onClose }: {
  title: string; text: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void
}) {
  return (
    <SimpleDialog title={title} onClose={onClose}>
      <p className="dialog-intro">{text}</p>
      <div className="dialog-actions">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
      </div>
    </SimpleDialog>
  )
}

export function ExpenseDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { db, money, openExpense, deleteExpense, restoreExpense, confirm, toast } = useApp()
  const expense = db.expenses.find((e) => e.id === id)
  const receiptSrc = useReceiptUrl(expense?.receipt)
  useEscape(onClose)
  if (!expense) return null
  const cat = db.categories.find((c) => c.name === expense.category)
  const remove = () =>
    confirm({
      title: "Delete this expense?", text: `“${expense.title}” (${money(expense.amount)}) will be removed from your records.`,
      confirmLabel: "Delete expense", danger: true,
      onConfirm: () => {
        deleteExpense(expense.id)
        onClose()
        toast("Expense deleted", { sub: expense.title, action: { label: "Undo", run: () => restoreExpense(expense) } })
      },
    })
  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="detail-drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div><span>EXPENSE DETAILS</span><h2>{expense.title}</h2></div>
          <IconButton label="Close details" onClick={onClose}><X size={21} /></IconButton>
        </div>
        <div className="drawer-amount">
          <span className="large-category-icon" style={cat ? { background: tint(cat.color), color: cat.color } : undefined}><CatIcon cat={cat} size={23} /></span>
          <div><small>Amount paid</small><strong>{money(expense.amount)}</strong></div>
        </div>
        <div className="drawer-section">
          <h3>Transaction information</h3>
          <dl>
            <div><dt>Category</dt><dd><CategoryBadge name={expense.category} categories={db.categories} /></dd></div>
            <div><dt>Subcategory</dt><dd>{expense.subcategory}</dd></div>
            <div><dt>Date & time</dt><dd>{fmtDate(expense.date)}<small>{fmtTime(expense.time)}</small></dd></div>
            <div><dt>Payment method</dt><dd><CreditCard size={15} /> {expense.payment}</dd></div>
            <div><dt>Merchant</dt><dd>{expense.merchant}</dd></div>
          </dl>
        </div>
        <div className="drawer-section">
          <h3>Notes</h3>
          <p className="note-box">{expense.note || "No notes were added to this expense."}</p>
        </div>
        <div className="drawer-section">
          <h3>Receipt</h3>
          {expense.receipt ? (
            !receiptSrc ? <p className="note-box">Loading receipt…</p> :
            expense.receipt.type.startsWith("image/") ? (
              <a href={receiptSrc} target="_blank" rel="noreferrer" className="receipt-view"><img src={receiptSrc} alt="Receipt" /></a>
            ) : (
              <a href={receiptSrc} target="_blank" rel="noreferrer" className="receipt-empty" style={{ textDecoration: "none" }}>
                <Paperclip size={20} /><span><strong>{expense.receipt.name}</strong><small>Click to open</small></span>
              </a>
            )
          ) : (
            <button className="receipt-empty" onClick={() => { onClose(); openExpense(expense) }}>
              <Receipt size={20} />
              <span><strong>No receipt attached</strong><small>Add a receipt when editing this expense</small></span>
            </button>
          )}
        </div>
        <div className="audit">
          <span>Created {fmtDate(expense.createdAt.slice(0, 10))}</span>
          <span>Last updated {fmtDate(expense.updatedAt.slice(0, 10))}</span>
        </div>
        <div className="drawer-actions">
          <Button variant="danger" onClick={remove}><Trash2 size={17} /> Delete</Button>
          <Button onClick={() => { onClose(); openExpense(expense) }}><Receipt size={17} /> Edit expense</Button>
        </div>
      </aside>
    </div>
  )
}
