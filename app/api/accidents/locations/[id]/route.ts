import { accidentResponse } from '@/lib/accidents/http'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, context: { params: Promise<{id:string}> }) { return accidentResponse(request, 'locations', (await context.params).id) }
