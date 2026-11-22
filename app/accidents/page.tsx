import type { Metadata } from 'next'
import { Suspense } from 'react'
import AccidentExplorer from '@/components/accidents/explorer'
import { BRAND } from '@/lib/brand'

const DESCRIPTION =
  '警察庁の交通事故オープンデータをもとに、全国の都道府県・市区町村ごと、歩行者・自転車別に事故の多い交差点や道路を調べられます。'

export const metadata: Metadata = {
  title: '街の事故を調べる',
  description: DESCRIPTION,
  alternates: { canonical: '/accidents' },
  openGraph: {
    title: `街の事故を調べる | ${BRAND.name}`,
    description: DESCRIPTION,
    url: '/accidents',
    type: 'website',
  },
}

export default function Page() { return <Suspense fallback={<p className="p-6">読み込み中…</p>}><AccidentExplorer /></Suspense> }
