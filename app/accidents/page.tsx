import { Suspense } from 'react'
import AccidentExplorer from '@/components/accidents/explorer'
export const metadata = { title: '街の事故を調べる | PathGuardian' }
export default function Page() { return <Suspense fallback={<p className="p-6">読み込み中…</p>}><AccidentExplorer /></Suspense> }
