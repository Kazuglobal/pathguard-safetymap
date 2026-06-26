import { redirect } from "next/navigation"

import { createServerClient } from "@/lib/supabase-server"
import { HunterGame } from "@/components/safety-quest/hunter/hunter-game"

export const metadata = {
  title: "きけんハンター | 通学路の危険をさがそう",
}

export default async function HunterPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  return <HunterGame />
}
