'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@ibizz/supabase'
import { AuthProvider, useAuth } from '@/lib/auth/AuthContext'
import { NotificationsProvider } from '@/lib/notifications/NotificationsContext'
import type { Project } from '@ibizz/supabase'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import ProjectDetail from '@/components/ProjectDetail'
import OverviewPage from '@/components/OverviewPage'
import AppsPage from '@/components/AppsPage'
import LoginPage from '@/components/LoginPage'

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#e63a1e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
]

function AppInner() {
  const { user, profile, loading } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showOverview, setShowOverview] = useState(false)
  const [showApps, setShowApps] = useState(false)
  const [addingProject, setAddingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectColor, setNewProjectColor] = useState('#6366f1')
  const supabase = createClient()

  useEffect(() => {
    if (!user) return

    supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setProjects(data ?? [])
        if (data && data.length > 0) setActiveId(prev => prev ?? data[0].id)
      })

    const channel = supabase
      .channel('projects-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        supabase.from('projects').select('*').order('created_at').then(({ data }) => setProjects(data ?? []))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  async function addProject() {
    const name = newProjectName.trim()
    if (!name) return
    const { data } = await supabase
      .from('projects')
      .insert({ name, color: newProjectColor })
      .select()
      .single()
    if (data) {
      setProjects(prev => [...prev, data])
      setActiveId(data.id)
    }
    setNewProjectName('')
    setNewProjectColor('#6366f1')
    setAddingProject(false)
  }

  async function handleColorChange(id: string, color: string) {
    await supabase.from('projects').update({ color }).eq('id', id)
    setProjects(prev => prev.map(p => p.id === id ? { ...p, color } : p))
  }

  async function handleDelete(id: string) {
    await supabase.from('projects').delete().eq('id', id)
    setProjects(prev => prev.filter(p => p.id !== id))
    if (activeId === id) setActiveId(prev => projects.find(p => p.id !== id)?.id ?? null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#e63a1e] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <LoginPage />

  const activeProject = projects.find(p => p.id === activeId)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        projects={projects}
        activeId={showOverview || showApps ? null : activeId}
        showOverview={showOverview}
        showApps={showApps}
        onSelect={id => { setActiveId(id); setShowOverview(false); setShowApps(false) }}
        onOverview={() => { setShowOverview(true); setShowApps(false) }}
        onApps={() => { setShowApps(true); setShowOverview(false) }}
        onAdd={() => setAddingProject(true)}
        onColorChange={handleColorChange}
        onDelete={handleDelete}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />

        {addingProject && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-xl p-6 w-96">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Nieuw project</h2>
              <input
                autoFocus
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addProject()
                  if (e.key === 'Escape') setAddingProject(false)
                }}
                placeholder="Naam van het project..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#e63a1e] mb-4"
              />
              <p className="text-xs text-gray-500 mb-2">Kleur</p>
              <div className="flex gap-2 mb-5 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      outline: newProjectColor === c ? `3px solid ${c}` : 'none',
                      outlineOffset: '2px',
                    }}
                    onClick={() => setNewProjectColor(c)}
                  />
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setAddingProject(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Annuleren
                </button>
                <button
                  onClick={addProject}
                  className="px-4 py-2 text-sm text-white rounded-lg"
                  style={{ backgroundColor: newProjectColor }}
                >
                  Aanmaken
                </button>
              </div>
            </div>
          </div>
        )}

        {showApps ? (
          <AppsPage />
        ) : showOverview ? (
          <OverviewPage projects={projects} />
        ) : activeProject ? (
          <div className="flex-1 overflow-hidden">
            <ProjectDetail
              projectId={activeProject.id}
              projectName={activeProject.name}
              projectColor={activeProject.color ?? '#6366f1'}
              userName={profile?.name ?? 'Gebruiker'}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">Geen projecten</p>
              <p className="text-sm">Maak een nieuw project aan via de sidebar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <AppInner />
      </NotificationsProvider>
    </AuthProvider>
  )
}
