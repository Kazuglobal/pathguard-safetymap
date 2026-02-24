import ThreeDRoutePocClient from './3d-route-poc-client'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'

export const metadata = { title: '3D通学路 PoC - PathGuardian' }

export default async function ThreeDRoutePocPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  return <ThreeDRoutePocClient />
}
