import { createServerClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import { loginPathFor } from "@/lib/auth/login-path"
import HazardGameClient from "./hazard-game-client"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "写真で危険さがし" }

export default async function HazardGamePage() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect(loginPathFor("/hazard-game"))
  }

  return <HazardGameClient />
}
