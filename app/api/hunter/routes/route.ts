import { NextResponse } from 'next/server'
import { getActor } from '@/lib/auth/actor'
import { listCourses, requireRouteUser } from '@/lib/hunter/routes/repository'
import { courseView, prepareCourse } from '@/lib/hunter/routes/service'
import { readRouteJson, requireSameOrigin, routeError } from '@/lib/hunter/routes/http'

export const runtime = 'nodejs'
export async function GET() {
  try {
    const actor = requireRouteUser(await getActor())
    return NextResponse.json({ courses: await Promise.all((await listCourses(actor)).map(course => courseView(actor, course))) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return routeError(error) }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    const actor = requireRouteUser(await getActor())
    const course = await prepareCourse(actor, await readRouteJson(request, 24_000_000))
    return NextResponse.json({ course: await courseView(actor, course) }, { status: 201 })
  } catch (error) { return routeError(error) }
}
