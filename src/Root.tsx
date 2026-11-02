import { useEffect, useState } from "react"
import { auth, configured, type AuthUser } from "./lib/backend"
import { AuthScreen, ConfigError, NewPasswordScreen, Splash } from "./Auth"
import App from "./App"

export default function Root() {
  const [state, setState] = useState<{ ready: boolean; user: AuthUser | null; recovery: boolean }>({ ready: false, user: null, recovery: false })
  useEffect(() => {
    if (!configured) return
    let alive = true
    auth.getUser().then((u) => alive && setState((s) => ({ ...s, ready: true, user: u }))).catch(() => alive && setState((s) => ({ ...s, ready: true })))
    const off = auth.onChange((ev, u) => setState((s) => ({
      ready: true,
      user: u && s.user && u.id === s.user.id ? s.user : u,
      recovery: ev === "PASSWORD_RECOVERY" ? true : ev === "SIGNED_OUT" ? false : s.recovery,
    })))
    return () => { alive = false; off() }
  }, [])

  if (!configured) return <ConfigError />
  if (!state.ready) return <Splash />
  if (state.recovery && state.user) return <NewPasswordScreen onDone={() => setState((s) => ({ ...s, recovery: false }))} />
  if (!state.user) return <AuthScreen />
  return <App key={state.user.id} user={state.user} />
}
