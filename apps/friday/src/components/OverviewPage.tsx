'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@ibizz/supabase'
import type { Project, ProjectLine } from '@ibizz/supabase'
import { calcProgress } from '@/lib/progress'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek, differenceInDays, parseISO, isWithinInterval } from 'date-fns'
import { nl } from 'date-fns/locale'
import { LayoutGrid, GanttChartSquare, CalendarDays, Users2, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Clock } from 'lucide-react'

type View = 'dashboard' | 'gantt' | 'agenda' | 'workload'

type ProjectWithLines = Project & { lines: ProjectLine[] }

type Props = { projects: Project[] }

function progressStats(lines: ProjectLine[]) {
  const total = lines.length
  if (total === 0) return { percent: 0, done: 0, inProgress: 0, todo: 0, overdue: 0 }
  const done = lines.filter(l => l.status === 'done').length
  const inProgress = lines.filter(l => l.status === 'in_progress').length
  const todo = lines.filter(l => l.status === 'todo').length
  const overdue = lines.filter(l => {
    if (l.status === 'done' || !l.due_date) return false
    return new Date(l.due_date) < new Date()
  }).length
  return { percent: Math.round((done / total) * 100), done, inProgress, todo, overdue }
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
function DashboardView({ data }: { data: ProjectWithLines[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {data.map(p => {
        const stats = progressStats(p.lines)
        const nextDue = p.lines
          .filter(l => l.due_date && l.status !== 'done')
          .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0]

        return (
          <div key={p.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Color bar */}
            <div className="h-1.5" style={{ backgroundColor: p.color }} />

            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{p.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{p.lines.length} taken</p>
                </div>
                {/* Progress ring */}
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="#f3f4f6" strokeWidth="4" />
                    <circle
                      cx="24" cy="24" r="20" fill="none"
                      stroke={p.color} strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 20}`}
                      strokeDashoffset={`${2 * Math.PI * 20 * (1 - stats.percent / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                    {stats.percent}%
                  </span>
                </div>
              </div>

              {/* Status pills */}
              <div className="flex gap-2 mb-4 flex-wrap">
                <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-50 text-green-700">
                  <CheckCircle2 size={11} /> {stats.done} done
                </span>
                <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                  <Clock size={11} /> {stats.inProgress} bezig
                </span>
                {stats.overdue > 0 && (
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-50 text-red-600">
                    <AlertCircle size={11} /> {stats.overdue} te laat
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${stats.percent}%`, backgroundColor: p.color }} />
              </div>

              {nextDue && (
                <p className="text-xs text-gray-400 mt-2">
                  Volgende deadline: <span className="text-gray-600 font-medium">{format(new Date(nextDue.due_date!), 'd MMM', { locale: nl })}</span>
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Gantt ────────────────────────────────────────────────────────────────────
function GanttView({ data }: { data: ProjectWithLines[] }) {
  const today = new Date()
  const [startMonth, setStartMonth] = useState(subMonths(today, 1))

  const months = [startMonth, addMonths(startMonth, 1), addMonths(startMonth, 2)]
  const rangeStart = startOfMonth(months[0])
  const rangeEnd = endOfMonth(months[months.length - 1])
  const totalDays = differenceInDays(rangeEnd, rangeStart) + 1

  function posPercent(date: Date) {
    return (differenceInDays(date, rangeStart) / totalDays) * 100
  }
  function widthPercent(start: Date, end: Date) {
    const days = Math.max(1, differenceInDays(end, start) + 1)
    return (days / totalDays) * 100
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <button onClick={() => setStartMonth(m => subMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft size={16} />
        </button>
        <div className="flex gap-6">
          {months.map(m => (
            <span key={m.toISOString()} className="text-sm font-semibold text-gray-700 capitalize">
              {format(m, 'MMMM yyyy', { locale: nl })}
            </span>
          ))}
        </div>
        <button onClick={() => setStartMonth(m => addMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="overflow-x-auto">
        {/* Timeline header */}
        <div className="relative" style={{ minWidth: '700px' }}>
          <div className="flex border-b border-gray-100">
            <div className="w-40 flex-shrink-0 px-4 py-2 text-xs font-semibold text-gray-500 border-r border-gray-100">Project</div>
            <div className="flex-1 relative h-8">
              {months.map((m, mi) => {
                const daysInMonth = eachDayOfInterval({ start: startOfMonth(m), end: endOfMonth(m) })
                return daysInMonth.map(day => (
                  <div
                    key={day.toISOString()}
                    className={`absolute top-0 bottom-0 flex items-center justify-center text-[10px] ${isToday(day) ? 'text-[#EB4628] font-bold' : 'text-gray-400'}`}
                    style={{ left: `${posPercent(day)}%`, width: `${widthPercent(day, day)}%` }}
                  >
                    {format(day, 'd') === '1' || isToday(day) ? format(day, 'd') : ''}
                  </div>
                ))
              })}
              {/* Month separators */}
              {months.map(m => (
                <div key={m.toISOString()} className="absolute top-0 bottom-0 border-l border-gray-200"
                  style={{ left: `${posPercent(startOfMonth(m))}%` }}>
                  <span className="absolute top-1 left-1 text-[10px] text-gray-400 capitalize whitespace-nowrap">
                    {format(m, 'MMM', { locale: nl })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          {data.map(p => {
            const datedLines = p.lines.filter(l => l.due_date)
            if (datedLines.length === 0) {
              return (
                <div key={p.id} className="flex border-b border-gray-50 hover:bg-gray-50 transition-colors" style={{ minWidth: '700px' }}>
                  <div className="w-40 flex-shrink-0 px-4 py-3 flex items-center gap-2 border-r border-gray-100">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-sm text-gray-700 truncate">{p.name}</span>
                  </div>
                  <div className="flex-1 relative py-3 px-2">
                    <span className="text-xs text-gray-400">Geen deadlines</span>
                  </div>
                </div>
              )
            }

            const earliest = datedLines.reduce((a, b) => new Date(a.start_date) < new Date(b.start_date) ? a : b)
            const latest = datedLines.reduce((a, b) => new Date(a.due_date!) > new Date(b.due_date!) ? a : b)
            const barStart = new Date(earliest.start_date)
            const barEnd = new Date(latest.due_date!)
            const stats = progressStats(p.lines)
            const clampedStart = barStart < rangeStart ? rangeStart : barStart
            const clampedEnd = barEnd > rangeEnd ? rangeEnd : barEnd

            if (clampedStart > rangeEnd || clampedEnd < rangeStart) {
              return (
                <div key={p.id} className="flex border-b border-gray-50 hover:bg-gray-50" style={{ minWidth: '700px' }}>
                  <div className="w-40 flex-shrink-0 px-4 py-3 flex items-center gap-2 border-r border-gray-100">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-sm text-gray-700 truncate">{p.name}</span>
                  </div>
                  <div className="flex-1 py-3 px-2"><span className="text-xs text-gray-400">Buiten periode</span></div>
                </div>
              )
            }

            return (
              <div key={p.id} className="flex border-b border-gray-50 hover:bg-gray-50 transition-colors" style={{ minWidth: '700px' }}>
                <div className="w-40 flex-shrink-0 px-4 py-3 flex items-center gap-2 border-r border-gray-100">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-sm text-gray-700 truncate">{p.name}</span>
                </div>
                <div className="flex-1 relative py-3">
                  {/* Today line */}
                  {isWithinInterval(today, { start: rangeStart, end: rangeEnd }) && (
                    <div className="absolute top-0 bottom-0 w-px bg-[#EB4628] opacity-40 z-10"
                      style={{ left: `${posPercent(today)}%` }} />
                  )}
                  <div
                    className="absolute top-3 h-6 rounded-full overflow-hidden"
                    style={{ left: `${posPercent(clampedStart)}%`, width: `${widthPercent(clampedStart, clampedEnd)}%`, backgroundColor: `${p.color}30` }}
                  >
                    <div className="h-full rounded-full" style={{ width: `${stats.percent}%`, backgroundColor: p.color }} />
                  </div>
                  <span
                    className="absolute top-3.5 text-[10px] font-bold text-white z-10"
                    style={{ left: `calc(${posPercent(clampedStart)}% + 6px)` }}
                  >
                    {stats.percent}%
                  </span>
                </div>
              </div>
            )
          })}

          {/* Today marker */}
          {isWithinInterval(today, { start: rangeStart, end: rangeEnd }) && (
            <div className="absolute top-8 bottom-0 w-px bg-[#EB4628] opacity-20 pointer-events-none"
              style={{ left: `calc(160px + (100% - 160px) * ${posPercent(today) / 100})` }} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Agenda ──────────────────────────────────────────────────────────────────
function AgendaView({ data }: { data: ProjectWithLines[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const tasksByDay = new Map<string, { line: ProjectLine; project: Project }[]>()
  data.forEach(p => {
    p.lines.forEach(l => {
      if (!l.due_date) return
      const key = l.due_date
      if (!tasksByDay.has(key)) tasksByDay.set(key, [])
      tasksByDay.get(key)!.push({ line: l, project: p })
    })
  })

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-gray-700 capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: nl })}
        </span>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd')
          const tasks = tasksByDay.get(key) ?? []
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
          return (
            <div
              key={key}
              className={`min-h-20 p-1.5 border-b border-r border-gray-100 ${isCurrentMonth ? '' : 'bg-gray-50'} ${isToday(day) ? 'bg-red-50' : ''}`}
            >
              <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                isToday(day) ? 'bg-[#EB4628] text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
              }`}>
                {format(day, 'd')}
              </span>
              <div className="space-y-0.5">
                {tasks.slice(0, 3).map(({ line, project }) => (
                  <div
                    key={line.id}
                    className="text-[10px] px-1.5 py-0.5 rounded truncate font-medium"
                    style={{ backgroundColor: `${project.color}20`, color: project.color }}
                    title={line.name}
                  >
                    {line.name}
                  </div>
                ))}
                {tasks.length > 3 && (
                  <div className="text-[10px] text-gray-400 px-1">+{tasks.length - 3} meer</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Workload ─────────────────────────────────────────────────────────────────
function WorkloadView({ data }: { data: ProjectWithLines[] }) {
  const ownerMap = new Map<string, { lines: (ProjectLine & { project: Project })[] }>()

  data.forEach(p => {
    p.lines.forEach(l => {
      const owner = l.owner_name ?? 'Niet toegewezen'
      if (!ownerMap.has(owner)) ownerMap.set(owner, { lines: [] })
      ownerMap.get(owner)!.lines.push({ ...l, project: p })
    })
  })

  const owners = Array.from(ownerMap.entries()).sort((a, b) => b[1].lines.length - a[1].lines.length)

  return (
    <div className="space-y-4">
      {owners.map(([owner, { lines }]) => {
        const done = lines.filter(l => l.status === 'done').length
        const overdue = lines.filter(l => l.due_date && l.status !== 'done' && new Date(l.due_date) < new Date()).length
        const initials = owner === 'Niet toegewezen' ? '?' : owner.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

        return (
          <div key={owner} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
              <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{owner}</p>
                <p className="text-xs text-gray-400">{lines.length} taken • {done} afgerond{overdue > 0 ? ` • ${overdue} te laat` : ''}</p>
              </div>
              {/* Mini progress */}
              <div className="w-24">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-400 rounded-full" style={{ width: `${Math.round((done / lines.length) * 100)}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 text-right mt-0.5">{Math.round((done / lines.length) * 100)}%</p>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {lines.slice(0, 5).map(l => {
                const { color } = calcProgress(l.start_date, l.due_date, l.status)
                return (
                  <div key={l.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: l.project.color }} />
                    <span className="text-sm text-gray-700 flex-1 truncate">{l.name}</span>
                    <span className="text-xs text-gray-400">{l.project.name}</span>
                    {l.due_date && (
                      <span className="text-xs font-medium" style={{ color }}>
                        {format(new Date(l.due_date), 'd MMM', { locale: nl })}
                      </span>
                    )}
                  </div>
                )
              })}
              {lines.length > 5 && (
                <div className="px-5 py-2 text-xs text-gray-400">+{lines.length - 5} meer taken</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OverviewPage({ projects }: Props) {
  const [view, setView] = useState<View>('dashboard')
  const [data, setData] = useState<ProjectWithLines[]>([])
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: lines } = await supabase.from('project_lines').select('*')
      const all = projects.map(p => ({
        ...p,
        lines: (lines ?? []).filter(l => l.project_id === p.id),
      }))
      setData(all)
    }
    load()
  }, [projects])

  const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard',  icon: <LayoutGrid size={15} /> },
    { id: 'gantt',     label: 'Gantt',       icon: <GanttChartSquare size={15} /> },
    { id: 'agenda',    label: 'Agenda',      icon: <CalendarDays size={15} /> },
    { id: 'workload',  label: 'Workload',    icon: <Users2 size={15} /> },
  ]

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Overzicht</h1>
            <p className="text-sm text-gray-500 mt-0.5">{projects.length} projecten</p>
          </div>

          {/* View switcher */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {VIEWS.map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  view === v.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v.icon}
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {view === 'dashboard' && <DashboardView data={data} />}
        {view === 'gantt'     && <GanttView data={data} />}
        {view === 'agenda'    && <AgendaView data={data} />}
        {view === 'workload'  && <WorkloadView data={data} />}
      </div>
    </div>
  )
}
