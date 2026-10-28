import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { RouteBuilder } from '@/components/safety-quest/hunter/routes/route-builder'

export const metadata = { title: '通学路 3分クイズ | きけんハンター' }

export default async function RoutePage() {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?next=/safety-quest/hunter/routes')
  return <RouteBuilder />
}
