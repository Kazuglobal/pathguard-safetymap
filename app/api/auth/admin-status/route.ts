import { NextResponse } from "next/server"

import { getCurrentUserAdminStatus } from "@/lib/admin-auth"

export async function GET() {
  const status = await getCurrentUserAdminStatus()

  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "no-store",
    },
  })
}
