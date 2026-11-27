import type { Metadata } from 'next'
import { Suspense } from 'react'
import LocationDetail from '@/components/accidents/location-detail'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  return {
    title: '事故地点の詳細',
    description: '警察庁の交通事故オープンデータに基づく、指定地点の事故件数・時間帯・状況の詳細ページです。',
    alternates: { canonical: `/accidents/locations/${encodeURIComponent(id)}` },
  }
}

export default async function Page({params}: {params:Promise<{id:string}>}) { const {id}=await params; return <Suspense fallback={<p>読み込み中…</p>}><LocationDetail id={id}/></Suspense> }
