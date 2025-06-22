import React from "react"
import { NavigationWrapper } from "@/components/ui/navigation-wrapper"
import { createServerClient } from "@/lib/supabase-server"
import { SupabaseProvider } from "@/components/providers/supabase-provider"

interface LayoutProviderProps {
  children: React.ReactNode
}

export async function LayoutProvider({ children }: LayoutProviderProps) {
  const supabase = await createServerClient()
  
  // ユーザー情報を取得（エラーハンドリング付き）
  let user = null
  try {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    user = currentUser
  } catch (error) {
    console.error("ユーザー情報の取得に失敗しました:", error)
  }

  const handleLogout = async () => {
    "use server"
    const supabase = await createServerClient()
    await supabase.auth.signOut()
  }

  return (
    <SupabaseProvider>
      <NavigationWrapper user={user} onLogout={handleLogout}>
        {children}
      </NavigationWrapper>
    </SupabaseProvider>
  )
}