import { NextResponse } from 'next/server'
import { getActor } from '@/lib/auth/actor'
import { getSchoolDistrictOptions } from '@/lib/db/repos/school-districts.repo'
import { ALL_PREFECTURES } from '@/lib/user-region'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const prefecture = params.get('prefecture') ?? ''
  const city = params.get('city') ?? undefined
  if (!(ALL_PREFECTURES as readonly string[]).includes(prefecture) || (city !== undefined && (!city.trim() || city.length > 80))) {
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 })
  }
  try {
    const options = await getSchoolDistrictOptions(await getActor(), prefecture, city)
    return NextResponse.json(options)
  } catch {
    return NextResponse.json({ error: 'Failed to load school districts' }, { status: 503 })
  }
}
