export function calcProgress(startDate: string, dueDate: string | null, status: string) {
  if (status === 'done') return { percent: 100, color: '#22c55e' }
  if (!dueDate) return { percent: 0, color: '#22c55e' }

  const start = new Date(startDate).getTime()
  const due = new Date(dueDate).getTime()
  const now = Date.now()

  const total = due - start
  if (total <= 0) return { percent: 100, color: '#ef4444' }

  const elapsed = now - start
  const percent = Math.min(Math.round((elapsed / total) * 100), 100)

  // Color logic: green → orange → red → deep red (overdue)
  const isOverdue = now > due
  let color: string

  if (isOverdue) {
    color = '#b91c1c' // deep red
  } else if (percent >= 80) {
    color = '#ef4444' // red
  } else if (percent >= 60) {
    color = '#f97316' // orange
  } else {
    color = '#22c55e' // green
  }

  return { percent: isOverdue ? 100 : percent, color }
}
