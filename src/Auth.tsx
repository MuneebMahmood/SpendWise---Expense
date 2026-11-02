import { useState, type FormEvent } from "react"
import { WalletCards } from "lucide-react"
import { auth } from "./lib/backend"
import { Button } from "./components/ui"

type Mode = "signin" | "signup" | "forgot"

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")

  const go = (m: Mode) => { setMode(m); setError(""); setInfo("") }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(""); setInfo("")
    const mail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return setError("Enter a valid email address.")
    if (mode !== "forgot" && password.length < 8) return setError("Password must be at least 8 characters.")
    if (mode === "signup" && !name.trim()) return setError("Please enter your name.")
    setBusy(true)
    try {
      if (mode === "signin") await auth.signIn(mail, password)
      else if (mode === "signup") {
        const r = await auth.signUp(mail, password, name.trim())
        if (r.needsConfirm) { setInfo("Account created! Check your email and click the confirmation link, then sign in."); setMode("signin"); setPassword("") }
      } else { await auth.resetPassword(mail); setInfo("If an account exists for that email, a reset link is on its way.") }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="lock-screen auth-screen">
      <form onSubmit={submit} noValidate>
        <span className="brand-mark"><WalletCards size={21} strokeWidth={2.3} /></span>
        <h1>Spend<span style={{ color: "var(--green)" }}>Wise</span></h1>
        <p>{mode === "signin" ? "Sign in to your expense dashboard." : mode === "signup" ? "Create your account — it takes a few seconds." : "Enter your email and we'll send a reset link."}</p>
        {mode === "signup" && (
          <label className="auth-field"><span>Full name</span><input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Muneeb Khan" /></label>
        )}
        <label className="auth-field"><span>Email</span><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
        {mode !== "forgot" && (
          <label className="auth-field"><span>Password</span>
            <input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          </label>
        )}
        {error && <em className="field-error auth-msg" role="alert">{error}</em>}
        {info && <em className="auth-info" role="status">{info}</em>}
        <Button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}</Button>
        <div className="auth-links">
          {mode === "signin" && (<><button type="button" onClick={() => go("forgot")}>Forgot password?</button><button type="button" onClick={() => go("signup")}>Create an account</button></>)}
          {mode !== "signin" && <button type="button" onClick={() => go("signin")}>← Back to sign in</button>}
        </div>
      </form>
    </div>
  )
}

export function NewPasswordScreen({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("")
  const [again, setAgain] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (pw.length < 8) return setError("Password must be at least 8 characters.")
    if (pw !== again) return setError("Passwords don't match.")
    setBusy(true)
    try { await auth.updatePassword(pw); onDone() } catch (err) { setError((err as Error).message); setBusy(false) }
  }
  return (
    <div className="lock-screen auth-screen">
      <form onSubmit={submit} noValidate>
        <span className="brand-mark"><WalletCards size={21} /></span>
        <h1>Set a new password</h1>
        <p>Choose a new password for your account.</p>
        <label className="auth-field"><span>New password</span><input type="password" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setError("") }} /></label>
        <label className="auth-field"><span>Confirm password</span><input type="password" autoComplete="new-password" value={again} onChange={(e) => { setAgain(e.target.value); setError("") }} /></label>
        {error && <em className="field-error auth-msg">{error}</em>}
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Update password"}</Button>
      </form>
    </div>
  )
}

export function Splash({ text = "Loading…" }: { text?: string }) {
  return <div className="lock-screen"><div className="splash"><span className="brand-mark"><WalletCards size={21} /></span><p>{text}</p></div></div>
}

export function ConfigError() {
  return (
    <div className="lock-screen auth-screen">
      <div className="auth-card-static">
        <h1>Supabase isn’t configured</h1>
        <p>Create a <code>.env</code> file next to <code>package.json</code> with:</p>
        <pre>{`VITE_SUPABASE_URL=https://YOUR-REF.supabase.co\nVITE_SUPABASE_ANON_KEY=sb_publishable_...`}</pre>
        <p>Then restart <code>npm run dev</code>. Use the <b>publishable/anon</b> key — never the service_role key.</p>
      </div>
    </div>
  )
}
