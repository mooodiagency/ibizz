'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth/AuthContext'
import type { LineMessage } from '@/lib/supabase/types'

export type Notification = {
  id: string
  message: string
  sender: string
  lineId: string
  lineName: string
  createdAt: string
  read: boolean
}

type NotificationsContextType = {
  notifications: Notification[]
  unreadCount: number
  markAllRead: () => void
}

const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
})

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!profile) return

    const channel = supabase
      .channel('global-mentions')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'line_messages',
      }, async (payload) => {
        const msg = payload.new as LineMessage & { line_id: string }
        const content = msg.content ?? ''
        const nameLower = profile.name.toLowerCase()

        // Check if current user is mentioned
        const isMentioned = content.toLowerCase().includes(`@${nameLower}`)
        if (!isMentioned) return
        if (msg.user_name === profile.name) return // don't notify for own messages

        // Fetch line name
        const { data: line } = await supabase
          .from('project_lines')
          .select('name')
          .eq('id', msg.line_id)
          .single()

        setNotifications(prev => [{
          id: msg.id,
          message: content,
          sender: msg.user_name,
          lineId: msg.line_id,
          lineName: line?.name ?? 'Taak',
          createdAt: msg.created_at,
          read: false,
        }, ...prev].slice(0, 20))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile])

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export const useNotifications = () => useContext(NotificationsContext)
