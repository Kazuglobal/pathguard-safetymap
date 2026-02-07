import { createServerClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import HazardGameClient from "./hazard-game-client"

export default async function HazardGamePage() {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect("/login")
  }

  return <HazardGameClient />
}
