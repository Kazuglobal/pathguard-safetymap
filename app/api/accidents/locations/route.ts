import { accidentResponse } from '@/lib/accidents/http'
export const dynamic = 'force-dynamic'
export function GET(request: Request) { return accidentResponse(request, 'locations') }
