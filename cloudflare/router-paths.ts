export type RouteBinding =
  | 'EDITORIAL'
  | 'MAP_3D'
  | 'MAP_UI'
  | 'ROUTE_QUIZ'
  | 'ROUTE_LIST'
  | 'MAP_DATA'
  | 'AI_VISION'
  | 'HUNTER'
  | 'SAFETY_QUEST'
  | 'AUTH_ADMIN'
  | 'COMMUNITY'
  | 'USER'
  | 'OPERATIONS'

const ROUTE_BINDINGS = [
  { binding: 'EDITORIAL', prefixes: ['/landing', '/lp', '/safe-magazine', '/school-route-news'] },
  { binding: 'MAP_3D', prefixes: ['/3d-route-poc'] },
  { binding: 'MAP_UI', prefixes: ['/map', '/xroad'] },
  { binding: 'ROUTE_QUIZ', prefixes: ['/route-quiz'] },
  { binding: 'ROUTE_LIST', prefixes: ['/routes'] },
  { binding: 'MAP_DATA', prefixes: ['/api/mapbox', '/api/traffic-accidents', '/api/xroad'] },
  { binding: 'AI_VISION', prefixes: ['/hazard-game', '/tools/image-gen', '/api/gemini', '/api/hazard', '/api/image', '/api/vlm'] },
  { binding: 'HUNTER', prefixes: ['/safety-quest/hunter', '/api/hunter'] },
  { binding: 'SAFETY_QUEST', prefixes: ['/safety-quest', '/api/safety-quest'] },
  {
    binding: 'AUTH_ADMIN',
    prefixes: [
      '/access-denied',
      '/admin',
      '/auth',
      '/forgot-password',
      '/login',
      '/register',
      '/reset-password',
      '/api/admin',
      '/api/auth',
      '/api/debug-env',
      '/api/debug',
      '/api/test-auth',
      '/api/test-openai',
    ],
  },
  { binding: 'COMMUNITY', prefixes: ['/report', '/api/abuse-report', '/api/danger-report', '/api/media', '/api/reactions', '/api/report-interactions', '/api/reports', '/api/suspicious-alert'] },
  { binding: 'USER', prefixes: ['/badges', '/dashboard', '/leaderboard', '/missions', '/mypage', '/api/gamification', '/api/missions', '/api/notifications', '/api/profile', '/api/push', '/api/routes'] },
  { binding: 'OPERATIONS', prefixes: ['/api/cron', '/api/local-safety-alerts'] },
] as const satisfies ReadonlyArray<{
  binding: RouteBinding
  prefixes: readonly string[]
}>

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function routeBindingForPath(pathname: string): RouteBinding | 'CORE' {
  for (const route of ROUTE_BINDINGS) {
    if (route.prefixes.some((prefix) => matchesPrefix(pathname, prefix))) {
      return route.binding
    }
  }
  return 'CORE'
}
