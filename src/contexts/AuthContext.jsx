import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [recoveryMode, setRecoveryMode] = useState(false)

  const loadProfile = useCallback(async (userId) => {
    setLoadingProfile(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, household_id, households ( id, name, invite_code )')
      .eq('id', userId)
      .single()
    if (!error) setProfile(data)
    setLoadingProfile(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      if (data.session) loadProfile(data.session.user.id)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
      }
      setSession(newSession)
      if (newSession) {
        loadProfile(newSession.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [loadProfile])

  const refreshProfile = useCallback(() => {
    if (session?.user?.id) return loadProfile(session.user.id)
  }, [session, loadProfile])

  const signOut = () => supabase.auth.signOut()

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loadingProfile,
    refreshProfile,
    signOut,
    recoveryMode,
    setRecoveryMode,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
