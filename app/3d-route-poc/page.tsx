import ThreeDRoutePocClient from './3d-route-poc-client'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'

export const metadata = { title: '3D通学路 PoC - PathGuardian' }

export default async function ThreeDRoutePocPage() {
  const supabase = await createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  return <ThreeDRoutePocClient />
}
