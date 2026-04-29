'use client'

import dynamic from 'next/dynamic'

const NotulistApp = dynamic(() => import('./NotulistClient'), { ssr: false })

export default function NotulistPage() {
  return <NotulistApp />
}
