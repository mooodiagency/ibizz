'use client'

import { useState } from 'react'
import { X, Save, User, Briefcase, Building2, Phone, AlignLeft, Circle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth/AuthContext'

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#EB4628',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
]

const AVAILABILITY_OPTIONS = [
  { value: 'available',  label: 'Beschikbaar',  color: '#22c55e' },
  { value: 'busy',       label: 'Bezet',         color: '#f97316' },
  { value: 'away',       label: 'Afwezig',       color: '#94a3b8' },
]

const DEPARTMENTS = ['Creative', 'Development', 'Account', 'Strategy', 'Operations', 'Management']

type Props = { onClose: () => void }

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        <span className="text-gray-400">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  )
}

export default function SettingsModal({ onClose }: Props) {
  const { profile, reloadProfile } = useAuth()
  const [name, setName] = useState(profile?.name ?? '')
  const [color, setColor] = useState(profile?.color ?? '#6366f1')
  const [func, setFunc] = useState(profile?.function ?? '')
  const [department, setDepartment] = useState(profile?.department ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [availability, setAvailability] = useState(profile?.availability ?? 'available')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
  const avail = AVAILABILITY_OPTIONS.find(a => a.value === availability)!

  async function save() {
    if (!profile) return
    setSaving(true)
    await supabase.from('profiles').update({
      name: name.trim(),
      color,
      function: func.trim() || null,
      department: department || null,
      phone: phone.trim() || null,
      availability,
      bio: bio.trim() || null,
    }).eq('id', profile.id)
    await reloadProfile()
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 800)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">Profiel instellingen</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Avatar + status */}
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow transition-colors"
                style={{ backgroundColor: color }}
              >
                {initials}
              </div>
              <span
                className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white"
                style={{ backgroundColor: avail.color }}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{name || 'Jouw naam'}</p>
              <p className="text-xs text-gray-500">{func || 'Functie'}</p>
              <p className="text-xs text-gray-400">{department || 'Afdeling'}</p>
            </div>
          </div>

          {/* Naam */}
          <Field icon={<User size={12} />} label="Naam">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Khalid Karmoudi"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#EB4628] transition-colors"
            />
          </Field>

          {/* Functie + Afdeling naast elkaar */}
          <div className="grid grid-cols-2 gap-3">
            <Field icon={<Briefcase size={12} />} label="Functie">
              <input
                type="text"
                value={func}
                onChange={e => setFunc(e.target.value)}
                placeholder="Designer"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#EB4628] transition-colors"
              />
            </Field>

            <Field icon={<Building2 size={12} />} label="Afdeling">
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#EB4628] transition-colors bg-white appearance-none"
              >
                <option value="">Kies afdeling</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          </div>

          {/* Telefoon */}
          <Field icon={<Phone size={12} />} label="Telefoon">
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+31 6 12345678"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#EB4628] transition-colors"
            />
          </Field>

          {/* Status */}
          <Field icon={<Circle size={12} />} label="Status">
            <div className="flex gap-2">
              {AVAILABILITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setAvailability(opt.value)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all"
                  style={{
                    borderColor: availability === opt.value ? opt.color : '#e5e7eb',
                    backgroundColor: availability === opt.value ? `${opt.color}15` : 'transparent',
                    color: availability === opt.value ? opt.color : '#6b7280',
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Bio */}
          <Field icon={<AlignLeft size={12} />} label="Bio">
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Korte omschrijving over jezelf..."
              rows={3}
              maxLength={200}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#EB4628] transition-colors resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-0.5">{bio.length}/200</p>
          </Field>

          {/* Avatar kleur */}
          <Field icon={<span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />} label="Avatar kleur">
            <div className="flex gap-2.5 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </Field>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: saved ? '#22c55e' : '#EB4628' }}
          >
            <Save size={15} />
            {saved ? 'Opgeslagen!' : saving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  )
}
