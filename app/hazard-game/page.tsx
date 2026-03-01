import { createServerClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import HazardGameClient from "./hazard-game-client"

export default async function HazardGamePage() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  return <HazardGameClient />
}
