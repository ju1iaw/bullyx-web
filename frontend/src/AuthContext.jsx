import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import * as api from './lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(nextSession) {
    if (!nextSession?.user) { setProfile(null); return null }
    const item = await api.getProfile(nextSession.access_token, nextSession.user.id)
    setProfile(item)
    return item
  }

  useEffect(() => {
    let active = true
    async function restore() {
      let stored = api.consumeCallbackSession() || api.getStoredSession()
      if (!stored || !api.isSupabaseConfigured) { if (active) setLoading(false); return }
      if (!stored.user) stored = await api.hydrateSessionUser(stored).catch(() => null)
      if (!stored) { if (active) setLoading(false); return }
      const expiresSoon = (stored.expires_at || 0) * 1000 < Date.now() + 60_000
      const next = expiresSoon ? await api.refreshSession(stored) : stored
      if (!active) return
      setSession(next)
      if (next) await loadProfile(next).catch(() => setProfile(null))
      if (active) setLoading(false)
    }
    restore()
    return () => { active = false }
  }, [])

  const value = useMemo(() => ({
    session, user: session?.user || null, profile, loading,
    async signIn(email, password) { const next = await api.signIn(email, password); setSession(next); await loadProfile(next); return next },
    signUp: api.signUp,
    async signOut() { if (session) await api.signOut(session.access_token); setSession(null); setProfile(null) },
    async refreshProfile() { return loadProfile(session) },
    async saveProfile(values) {
      const next = await api.saveProfile(session.access_token, { id: session.user.id, email: session.user.email, ...values, updated_at: new Date().toISOString() })
      setProfile(next); return next
    },
  }), [session, profile, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() { return useContext(AuthContext) }
