'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@ibizz/supabase'

type AuthContextType = {
  user: User | null
  userName: string
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userName: '',
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  async function loadName(userId: string) {
    const { data } = await supabase.from('profiles').select('name').eq('id', userId).single()
    setUserName(data?.name ?? '')
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadName(session.user.id)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadName(session.user.id)
      else setUserName('')
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signOut() { await supabase.auth.signOut() }

  return (
    <AuthContext.Provider value={{ user, userName, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
