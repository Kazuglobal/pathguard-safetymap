export type Actor =
  | { kind: 'anon' }
  | { kind: 'user'; id: string; email: string | null; isAdmin: boolean }
  | { kind: 'service' }

export type Action = 'select' | 'insert' | 'update' | 'delete'

export const AUTHZ_TABLES = [
  'danger_reports',
  'danger_report_moderation_log',
  'danger_report_reactions',
  'profiles',
  'notifications',
  'report_comments',
  'report_likes',
  'report_bookmarks',
  'report_shares',
  'report_flags',
  'report_images',
  'user_routes',
  'route_learning_sessions',
  'user_points',
  'user_badges',
  'badges',
  'missions',
  'user_mission_progress',
  'safety_quest_attempts',
  'hunter_photos',
  'hazard_detections',
  'hunter_audit_log',
  'hazard_zones',
  'hazard_zone_coverage',
  'hazard_image_cache',
  'image_generation_gate_log',
  'push_subscriptions',
  'local_safety_alerts',
  'api_usage_logs',
  'api_budget_settings',
  'traffic_accidents',
] as const

export type Table = (typeof AUTHZ_TABLES)[number]

export interface AuthzContext {
  ownerId?: string | null
  targetUserId?: string | null
  status?: string | null
  role?: string | null
  changedFields?: readonly string[]
  notificationType?: string | null
  reportId?: string | null
  publicPreview?: boolean
  reportPublic?: boolean
  displayOnly?: boolean
  aggregateOnly?: boolean
  leaderboard?: boolean
}
