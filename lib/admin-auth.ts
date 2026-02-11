import { createServerClient } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/admin'

export type AdminStatus = {
  readonly isAuthenticated: boolean
  readonly isAdmin: boolean
}

export async function getCurrentUserAdminStatus(): Promise<AdminStatus> {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { isAuthenticated: false, isAdmin: false }
  }

  if (isAdminEmail(user.email)) {
    return { isAuthenticated: true, isAdmin: true }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[admin-auth] Failed to fetch profile role:', profileError.message)
    return { isAuthenticated: true, isAdmin: false }
  }

  return { isAuthenticated: true, isAdmin: profile?.role === 'admin' }
}

export async function verifyAdminRequest(): Promise<{
  readonly authorized: boolean
  readonly status?: 401 | 403
  readonly error?: string
}> {
  const status = await getCurrentUserAdminStatus()

  if (!status.isAuthenticated) {
    return {
      authorized: false,
      status: 401,
      error: '認証が必要です',
    }
  }

  if (!status.isAdmin) {
    return {
      authorized: false,
      status: 403,
      error: '管理者権限が必要です',
    }
  }

  return { authorized: true }
}
