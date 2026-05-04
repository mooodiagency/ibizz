'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react'
import { useBrand } from '@/lib/brand'
import NewBrandModal from './NewBrandModal'

export default function BrandSwitcher() {
  const { brands, current, setCurrent, deleteBrand } = useBrand()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const confirmBrand = brands.find(b => b.id === confirmDelete)

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm"
        >
          {current ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: current.color }} />
              <span className="font-semibold text-gray-800">{current.name}</span>
            </>
          ) : (
            <span className="text-gray-400">Geen merk</span>
          )}
          <ChevronDown size={14} className="text-gray-400" />
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 min-w-[220px] bg-white border border-gray-200 rounded-xl shadow-xl py-1">
            {brands.length === 0 && (
              <p className="px-3 py-3 text-xs text-gray-400">Nog geen merken</p>
            )}
            {brands.map(b => (
              <div key={b.id} className="group flex items-center hover:bg-gray-50">
                <button
                  onClick={() => { setCurrent(b); setOpen(false) }}
                  className="flex-1 flex items-center gap-2 px-3 py-2 text-left text-sm"
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                  <span className={`truncate ${current?.id === b.id ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                    {b.name}
                  </span>
                </button>
                <div className="opacity-0 group-hover:opacity-100 flex items-center pr-2">
                  <button
                    onClick={() => { setEditing(b.id); setOpen(false) }}
                    className="p-1 text-gray-400 hover:text-gray-700 rounded"
                    title="Bewerken"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={() => { setConfirmDelete(b.id); setOpen(false) }}
                    className="p-1 text-gray-400 hover:text-red-500 rounded"
                    title="Verwijderen"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                onClick={() => { setAdding(true); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Plus size={13} className="text-[#EB4628]" />
                Nieuw merk
              </button>
            </div>
          </div>
        )}
      </div>

      {adding && <NewBrandModal onClose={() => setAdding(false)} />}
      {editing && (
        <NewBrandModal
          editId={editing}
          onClose={() => setEditing(null)}
        />
      )}

      {confirmBrand && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-2">Merk verwijderen?</h3>
            <p className="text-xs text-gray-400 text-center mb-1">
              "<span className="font-semibold text-gray-700">{confirmBrand.name}</span>" en alle bijbehorende afbeeldingen worden verwijderd.
            </p>
            <p className="text-xs text-gray-400 text-center mb-6">Dit kan niet ongedaan worden gemaakt.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                Annuleren
              </button>
              <button
                onClick={() => { deleteBrand(confirmBrand.id); setConfirmDelete(null) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600"
              >
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
