import ThreeDRoutePocClient from './3d-route-poc-client'
import { redirect } from 'next/navigation'
import { loginPathFor } from '@/lib/auth/login-path'
import { createServerClient } from '@/lib/supabase-server'

export const metadata = { title: '3D通学路(試作)' }

export default async function ThreeDRoutePocPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect(loginPathFor('/3d-route-poc'))
  }

  return <ThreeDRoutePocClient />
}
