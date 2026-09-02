import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache'

const config = defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
})

const splitFunction = (
  routes: NonNullable<typeof config.functions>[string]['routes'],
  patterns: string[],
): NonNullable<typeof config.functions>[string] => ({
  ...config.default,
  routes,
  patterns,
})

// Cloudflare Workers Free has a 3 MiB compressed script limit. Keep the
// OpenNext routing/middleware layer small and split the Next server by route
// family so each service-bound Worker can stay under that hard platform cap.
const coreRoutes: NonNullable<typeof config.functions>[string]['routes'] = [
  'app/_global-error/page',
  'app/_not-found/page',
  'app/page',
  'app/contact/page',
  'app/privacy/page',
  'app/terms/page',
]

const routeGroups = {
  core: splitFunction(coreRoutes, ['*']),
  editorial: splitFunction([
    'app/landing/page',
    'app/lp/page',
    'app/safe-magazine/page',
    'app/safe-magazine/[slug]/page',
    'app/school-route-news/page',
    'app/school-route-news/[slug]/page',
  ], [
    'landing*',
    'lp*',
    'safe-magazine*',
    'school-route-news*',
  ]),
  map3d: splitFunction([
    'app/3d-route-poc/page',
  ], [
    '3d-route-poc*',
  ]),
  mapUi: splitFunction([
    'app/map/page',
    'app/xroad/page',
  ], [
    'map*',
    'xroad*',
  ]),
  routeQuiz: splitFunction([
    'app/route-quiz/page',
  ], [
    'route-quiz*',
  ]),
  routeList: splitFunction([
    'app/routes/page',
  ], [
    'routes*',
  ]),
  mapData: splitFunction([
    'app/api/mapbox/directions/route',
    'app/api/mapbox/geocode/route',
    'app/api/mapbox/isochrone/route',
    'app/api/mapbox/matrix/route',
    'app/api/mapbox/tilequery/route',
    'app/api/traffic-accidents/bbox/route',
    'app/api/traffic-accidents/nearby/route',
    'app/api/xroad-proxy/route',
    'app/api/xroad/route',
  ], [
    'api/mapbox/*',
    'api/traffic-accidents/*',
    'api/xroad*',
  ]),
  aiVision: splitFunction([
    'app/hazard-game/page',
    'app/tools/image-gen/page',
    'app/api/gemini/generate-image/route',
    'app/api/gemini/generate-prompts/route',
    'app/api/hazard-game/analyze/route',
    'app/api/hazard/image/route',
    'app/api/hazard/route-risks/route',
    'app/api/image/process/route',
    'app/api/vlm/analyze-hazard/route',
  ], [
    'hazard-game*',
    'tools/image-gen*',
    'api/gemini/*',
    'api/hazard*',
    'api/image/*',
    'api/vlm/*',
  ]),
  hunter: splitFunction([
    'app/safety-quest/hunter/page',
    'app/api/hunter/analyze/route',
    'app/api/hunter/photo/[id]/route',
    'app/api/hunter/photos/route',
    'app/api/hunter/session/route',
  ], [
    'safety-quest/hunter*',
    'api/hunter/*',
  ]),
  safetyQuest: splitFunction([
    'app/safety-quest/page',
    'app/api/safety-quest/attempts/route',
    'app/api/safety-quest/challenges/route',
    'app/api/safety-quest/private-practice/route',
    'app/api/safety-quest/profile/route',
  ], [
    'safety-quest',
    'api/safety-quest/*',
  ]),
  authAdmin: splitFunction([
    'app/access-denied/page',
    'app/admin/costs/page',
    'app/admin/dashboard/page',
    'app/admin/reports/page',
    'app/auth/callback/route',
    'app/forgot-password/page',
    'app/login/page',
    'app/register/page',
    'app/reset-password/page',
    'app/api/admin/costs/budget/route',
    'app/api/admin/costs/mapbox-usage/route',
    'app/api/admin/costs/route',
    'app/api/admin/reports/route',
    'app/api/auth/admin-status/route',
    'app/api/auth/line/callback/route',
    'app/api/auth/line/start/route',
    'app/api/debug-env/route',
    'app/api/debug/mapbox/route',
    'app/api/test-auth/route',
    'app/api/test-openai/route',
  ], [
    'access-denied*',
    'admin*',
    'auth*',
    'forgot-password*',
    'login*',
    'register*',
    'reset-password*',
    'api/admin/*',
    'api/auth/*',
    'api/debug*',
    'api/test-*',
  ]),
  community: splitFunction([
    'app/report/page',
    'app/api/abuse-report/route',
    'app/api/danger-report/moderate/route',
    'app/api/media/private/[...key]/route',
    'app/api/reactions/route',
    'app/api/report-interactions/route',
    'app/api/reports/[id]/accident-stats/route',
    'app/api/reports/[id]/comments/route',
    'app/api/reports/[id]/interactions/[kind]/route',
    'app/api/reports/[id]/route',
    'app/api/reports/route',
    'app/api/suspicious-alert/moderate/route',
  ], [
    'report*',
    'api/abuse-report*',
    'api/danger-report/*',
    'api/media/*',
    'api/reactions*',
    'api/report-interactions*',
    'api/reports*',
    'api/suspicious-alert/*',
  ]),
  user: splitFunction([
    'app/badges/page',
    'app/dashboard/page',
    'app/leaderboard/page',
    'app/missions/page',
    'app/mypage/page',
    'app/api/gamification/route',
    'app/api/missions/route',
    'app/api/notifications/route',
    'app/api/profile/avatar/route',
    'app/api/profile/route',
    'app/api/push/notify-content/route',
    'app/api/push/notify-danger-report/route',
    'app/api/push/subscribe/route',
    'app/api/push/unsubscribe/route',
    'app/api/routes/[id]/learning-sessions/route',
    'app/api/routes/[id]/route',
    'app/api/routes/route',
  ], [
    'badges*',
    'dashboard*',
    'leaderboard*',
    'missions*',
    'mypage*',
    'api/gamification*',
    'api/missions*',
    'api/notifications*',
    'api/profile*',
    'api/push/*',
    'api/routes*',
  ]),
  operations: splitFunction([
    'app/api/cron/daily-news-digest/route',
    'app/api/cron/hunter-retention-cleanup/route',
    'app/api/cron/local-alert-fetcher/route',
    'app/api/cron/local-safety-alerts/route',
    'app/api/cron/moderation-sweep/route',
    'app/api/cron/push-danger-reports/route',
    'app/api/cron/r2-orphan-cleanup/route',
    'app/api/local-safety-alerts/route',
  ], [
    'api/cron/*',
    'api/local-safety-alerts*',
  ]),
} satisfies NonNullable<typeof config.functions>

const buildTarget = process.env.OPENNEXT_TARGET
if (buildTarget) {
  if (!(buildTarget in routeGroups)) {
    throw new Error(`Unknown OPENNEXT_TARGET: ${buildTarget}`)
  }

  const targetFunction = routeGroups[buildTarget as keyof typeof routeGroups]

  // Build one named function at a time. The post-build bundler temporarily
  // presents that named output as `default`, because the Cloudflare adapter's
  // final esbuild pass currently only accepts that directory name.
  config.functions = {
    [buildTarget]: targetFunction,
  }
} else {
  config.functions = routeGroups
}

export default config
