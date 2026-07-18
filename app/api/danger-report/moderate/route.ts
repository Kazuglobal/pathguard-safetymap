import { NextRequest } from "next/server"

import { handleDangerReportModeration } from "@/lib/danger-report-moderation-handler"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  return handleDangerReportModeration(request)
}
