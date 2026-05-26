'use client'

import { useState } from 'react'
import { Globe, MapPin, Mail, Compass, Plus, X, Building } from 'lucide-react'
import { Select } from '@ibizz/ui'
import type { LocationTargeting, LocationItem } from '@/lib/location-targeting'

type ItemKind = LocationItem['kind']

const KIND_OPTIONS: { value: ItemKind; label: string; icon: React.ReactNode }[] = [
  { value: 'country',     label: 'Land',         icon: <Globe size={11} /> },
  { value: 'city',        label: 'Stad',         icon: <Building size={11} /> },
  { value: 'postcode',    label: 'Postcode',     icon: <Mail size={11} /> },
  { value: 'radius',      label: 'Straal (stad)', icon: <MapPin size={11} /> },
  { value: 'coordinates', label: 'Coördinaten',  icon: <Compass size={11} /> },
]

type Props = {
  value: LocationTargeting
  onChange: (next: LocationTargeting) => void
}

export default function LocationPicker({ value, onChange }: Props) {
  const [adding, setAdding] = useState(false)

  function removeItem(idx: number) {
    onChange({ ...value, items: value.items.filter((_, i) => i !== idx) })
  }

  function addItem(item: LocationItem) {
    onChange({ ...value, items: [...value.items, item] })
    setAdding(false)
  }

  return (
    <div className="space-y-2">
      {/* Items lijst */}
      {value.items.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Nog geen locaties — voeg er één toe.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {value.items.map((item, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-1.5 bg-gray-100 rounded-lg pl-2 pr-1 py-1 text-xs"
            >
              <LocationBadge item={item} />
              <button
                onClick={() => removeItem(idx)}
                className="text-gray-400 hover:text-red-500 p-0.5"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Toevoegen */}
      {adding ? (
        <AddRow onAdd={addItem} onCancel={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#EB4628] hover:underline"
        >
          <Plus size={11} /> Locatie toevoegen
        </button>
      )}

      {/* Targeting type */}
      <div className="pt-2 mt-2 border-t border-gray-100 flex items-center gap-2">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Targeting</span>
        <Select
          value={value.targetingType}
          onChange={v => onChange({ ...value, targetingType: v as LocationTargeting['targetingType'] })}
          options={[
            { value: 'presence', label: 'Aanwezigheid (aanbevolen)' },
            { value: 'presence_or_interest', label: 'Aanwezigheid of interesse' },
          ]}
          className="w-60"
        />
      </div>
    </div>
  )
}

function LocationBadge({ item }: { item: LocationItem }) {
  switch (item.kind) {
    case 'country':
      return <><Globe size={11} className="text-gray-500" /><span>{item.value}</span></>
    case 'city':
      return <><Building size={11} className="text-gray-500" /><span>{item.value}</span></>
    case 'postcode':
      return <><Mail size={11} className="text-gray-500" /><span>{item.value}{item.country ? ` · ${item.country}` : ''}</span></>
    case 'radius':
      return <><MapPin size={11} className="text-gray-500" /><span>{item.radiusKm}km rond {item.centerCity}</span></>
    case 'coordinates':
      return <><Compass size={11} className="text-gray-500" /><span>{item.lat.toFixed(3)},{item.lng.toFixed(3)} ({item.radiusKm}km)</span></>
  }
}

function AddRow({ onAdd, onCancel }: { onAdd: (item: LocationItem) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<ItemKind>('country')
  const [value1, setValue1] = useState('')  // country/city/postcode/radius-centerCity
  const [value2, setValue2] = useState('')  // postcode country / radius km / coords lat
  const [value3, setValue3] = useState('')  // coords lng
  const [value4, setValue4] = useState('25') // coords radius km

  function submit() {
    if (kind === 'country' && value1.trim()) return onAdd({ kind: 'country', value: value1.trim() })
    if (kind === 'city' && value1.trim()) return onAdd({ kind: 'city', value: value1.trim() })
    if (kind === 'postcode' && value1.trim()) {
      return onAdd({ kind: 'postcode', value: value1.trim(), country: value2.trim() || undefined })
    }
    if (kind === 'radius' && value1.trim() && Number(value2) > 0) {
      return onAdd({ kind: 'radius', centerCity: value1.trim(), radiusKm: Number(value2) })
    }
    if (kind === 'coordinates' && Number(value2) && Number(value3) && Number(value4) > 0) {
      return onAdd({ kind: 'coordinates', lat: Number(value2), lng: Number(value3), radiusKm: Number(value4) })
    }
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Select
          value={kind}
          onChange={v => setKind(v as ItemKind)}
          options={KIND_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          className="w-40"
        />
        {kind === 'country' && (
          <input
            value={value1}
            onChange={e => setValue1(e.target.value)}
            placeholder="bijv. Netherlands"
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#EB4628]"
          />
        )}
        {kind === 'city' && (
          <input
            value={value1}
            onChange={e => setValue1(e.target.value)}
            placeholder="bijv. Amsterdam"
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#EB4628]"
          />
        )}
        {kind === 'postcode' && (
          <>
            <input
              value={value1}
              onChange={e => setValue1(e.target.value)}
              placeholder="bijv. 1011 AB"
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#EB4628]"
            />
            <input
              value={value2}
              onChange={e => setValue2(e.target.value)}
              placeholder="NL"
              className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#EB4628]"
            />
          </>
        )}
        {kind === 'radius' && (
          <>
            <input
              value={value1}
              onChange={e => setValue1(e.target.value)}
              placeholder="stad"
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#EB4628]"
            />
            <input
              value={value2}
              onChange={e => setValue2(e.target.value)}
              placeholder="km"
              type="number"
              className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#EB4628]"
            />
          </>
        )}
        {kind === 'coordinates' && (
          <>
            <input
              value={value2}
              onChange={e => setValue2(e.target.value)}
              placeholder="lat"
              type="number"
              step="0.0001"
              className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#EB4628]"
            />
            <input
              value={value3}
              onChange={e => setValue3(e.target.value)}
              placeholder="lng"
              type="number"
              step="0.0001"
              className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#EB4628]"
            />
            <input
              value={value4}
              onChange={e => setValue4(e.target.value)}
              placeholder="km"
              type="number"
              className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#EB4628]"
            />
          </>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-2.5 py-1 rounded-lg text-xs text-gray-600 hover:bg-gray-100"
        >
          Annuleren
        </button>
        <button
          onClick={submit}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white hover:opacity-90"
          style={{ backgroundColor: '#EB4628' }}
        >
          Toevoegen
        </button>
      </div>
    </div>
  )
}
