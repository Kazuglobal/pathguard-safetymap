import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase-server"
import MapContainer from "@/components/map/map-container"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

export default async function RootPage() {
  // ルートページにアクセスした場合、ランディングページにリダイレクト
  redirect("/landing")
}
