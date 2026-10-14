import { Suspense } from 'react'
import LocationDetail from '@/components/accidents/location-detail'
export default async function Page({params}: {params:Promise<{id:string}>}) { const {id}=await params; return <Suspense fallback={<p>読み込み中…</p>}><LocationDetail id={id}/></Suspense> }
