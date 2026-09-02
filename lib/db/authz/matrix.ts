import type { Action, Table } from './types'

type MatrixCell = 'none' | 'own' | 'public' | 'authenticated' | 'admin' | 'service' | 'conditional'

/**
 * Reviewable summary of the application-layer policy surface replacing RLS.
 * The executable row/column predicates live in guard.ts.
 */
export const AUTHZ_MATRIX: Readonly<Record<Table, Readonly<Record<Action, MatrixCell>>>> = {
  danger_reports: { select: 'conditional', insert: 'conditional', update: 'conditional', delete: 'conditional' },
  danger_report_moderation_log: { select: 'admin', insert: 'service', update: 'service', delete: 'none' },
  danger_report_reactions: { select: 'own', insert: 'own', update: 'none', delete: 'own' },
  profiles: { select: 'conditional', insert: 'own', update: 'own', delete: 'none' },
  notifications: { select: 'own', insert: 'conditional', update: 'own', delete: 'own' },
  report_comments: { select: 'public', insert: 'own', update: 'own', delete: 'conditional' },
  report_likes: { select: 'own', insert: 'own', update: 'none', delete: 'own' },
  report_bookmarks: { select: 'own', insert: 'own', update: 'none', delete: 'own' },
  report_shares: { select: 'own', insert: 'conditional', update: 'none', delete: 'none' },
  report_flags: { select: 'own', insert: 'own', update: 'none', delete: 'own' },
  report_images: { select: 'conditional', insert: 'own', update: 'own', delete: 'conditional' },
  user_routes: { select: 'own', insert: 'own', update: 'own', delete: 'own' },
  route_learning_sessions: { select: 'own', insert: 'own', update: 'own', delete: 'own' },
  user_points: { select: 'conditional', insert: 'service', update: 'service', delete: 'none' },
  user_badges: { select: 'own', insert: 'own', update: 'own', delete: 'own' },
  badges: { select: 'authenticated', insert: 'service', update: 'service', delete: 'service' },
  missions: { select: 'authenticated', insert: 'service', update: 'service', delete: 'service' },
  user_mission_progress: { select: 'own', insert: 'own', update: 'own', delete: 'own' },
  safety_quest_attempts: { select: 'own', insert: 'own', update: 'own', delete: 'own' },
  hunter_photos: { select: 'own', insert: 'own', update: 'none', delete: 'own' },
  hazard_detections: { select: 'own', insert: 'own', update: 'none', delete: 'own' },
  hunter_audit_log: { select: 'own', insert: 'own', update: 'none', delete: 'own' },
  hazard_zones: { select: 'authenticated', insert: 'service', update: 'service', delete: 'service' },
  hazard_zone_coverage: { select: 'authenticated', insert: 'service', update: 'service', delete: 'service' },
  hazard_image_cache: { select: 'authenticated', insert: 'service', update: 'service', delete: 'service' },
  image_generation_gate_log: { select: 'admin', insert: 'service', update: 'service', delete: 'none' },
  push_subscriptions: { select: 'own', insert: 'own', update: 'own', delete: 'own' },
  local_safety_alerts: { select: 'public', insert: 'service', update: 'service', delete: 'service' },
  api_usage_logs: { select: 'admin', insert: 'service', update: 'service', delete: 'none' },
  api_budget_settings: { select: 'admin', insert: 'service', update: 'conditional', delete: 'none' },
  traffic_accidents: { select: 'authenticated', insert: 'service', update: 'service', delete: 'service' },
}
