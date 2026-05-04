'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@ibizz/supabase'
import type { Brand } from '@ibizz/supabase'
import { useAuth } from './auth'

type BrandContextType = {
  brands: Brand[]
  current: Brand | null
  loading: boolean
  setCurrent: (b: Brand) => void
  refresh: () => Promise<void>
  createBrand: (name: string, color: string) => Promise<Brand | null>
  updateBrand: (id: string, patch: Partial<Pick<Brand, 'name' | 'color'>>) => Promise<void>
  deleteBrand: (id: string) => Promise<void>
}

const BrandContext = createContext<BrandContextType>({
  brands: [],
  current: null,
  loading: true,
  setCurrent: () => {},
  refresh: async () => {},
  createBrand: async () => null,
  updateBrand: async () => {},
  deleteBrand: async () => {},
})

const STORAGE_KEY = 'brandstudio:current_brand_id'

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { userName } = useAuth()
  const [brands, setBrands] = useState<Brand[]>([])
  const [current, setCurrentState] = useState<Brand | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('brands').select('*').order('created_at')
    const list = (data ?? []) as Brand[]
    setBrands(list)

    // current intact houden of eerste/saved kiezen
    setCurrentState(prev => {
      if (prev && list.some(b => b.id === prev.id)) {
        return list.find(b => b.id === prev.id) ?? prev
      }
      const savedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      const fromStorage = savedId ? list.find(b => b.id === savedId) : null
      return fromStorage ?? list[0] ?? null
    })
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  function setCurrent(b: Brand) {
    setCurrentState(b)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, b.id)
  }

  async function createBrand(name: string, color: string): Promise<Brand | null> {
    const { data, error } = await supabase.from('brands').insert({
      name,
      color,
      created_by_name: userName || null,
    }).select().single()
    if (error) {
      console.error('Brand insert fout:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      throw new Error(error.message || 'Onbekende fout')
    }
    if (!data) return null
    const brand = data as Brand
    setBrands(prev => [...prev, brand])
    setCurrent(brand)
    return brand
  }

  async function updateBrand(id: string, patch: Partial<Pick<Brand, 'name' | 'color'>>) {
    await supabase.from('brands').update(patch).eq('id', id)
    setBrands(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b))
    setCurrentState(prev => (prev?.id === id ? { ...prev, ...patch } : prev))
  }

  async function deleteBrand(id: string) {
    await supabase.from('brands').delete().eq('id', id)
    setBrands(prev => {
      const next = prev.filter(b => b.id !== id)
      if (current?.id === id) {
        const fallback = next[0] ?? null
        setCurrentState(fallback)
        if (fallback && typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, fallback.id)
      }
      return next
    })
  }

  return (
    <BrandContext.Provider value={{ brands, current, loading, setCurrent, refresh, createBrand, updateBrand, deleteBrand }}>
      {children}
    </BrandContext.Provider>
  )
}

export const useBrand = () => useContext(BrandContext)
