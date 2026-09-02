import type { Action, Actor, AuthzContext, Table } from './types'

const PUBLIC_REPORT_STATUSES = new Set(['approved', 'published', 'resolved'])

const REPORT_MODERATION_FIELDS = new Set([
  'status',
  'push_notified_at',
  'ai_moderation_status',
  'ai_moderation_reason',
  'ai_moderation_score',
  'ai_moderation_checked_at',
])

const OWNED_TABLES = new Set<Table>([
  'user_routes',
  'route_learning_sessions',
  'user_badges',
  'user_mission_progress',
  'safety_quest_attempts',
  'push_subscriptions',
])

const SOCIAL_TABLES = new Set<Table>([
  'report_likes',
  'report_bookmarks',
  'danger_report_reactions',
  'report_flags',
])

const HUNTER_TABLES = new Set<Table>([
  'hunter_photos',
  'hazard_detections',
  'hunter_audit_log',
])

const REFERENCE_TABLES = new Set<Table>([
  'badges',
  'missions',
  'hazard_zones',
  'hazard_zone_coverage',
  'hazard_image_cache',
  'traffic_accidents',
])

const OPERATIONAL_TABLES = new Set<Table>([
  'image_generation_gate_log',
  'api_usage_logs',
  'api_budget_settings',
  'danger_report_moderation_log',
])

export class AuthzError extends Error {
  readonly status = 403
  readonly code = 'FORBIDDEN'

  constructor(action: Action, table: Table) {
    super(`Not authorized to ${action} ${table}`)
    this.name = 'AuthzError'
  }
}

function isUser(actor: Actor): actor is Extract<Actor, { kind: 'user' }> {
  return actor.kind === 'user'
}

function isOwner(actor: Actor, context: AuthzContext): boolean {
  return isUser(actor) && context.ownerId === actor.id
}

function onlyChanges(context: AuthzContext, allowed: ReadonlySet<string>): boolean {
  const fields = context.changedFields ?? []
  return fields.length > 0 && fields.every((field) => allowed.has(field))
}

function changesNoModerationField(context: AuthzContext): boolean {
  return (context.changedFields ?? []).every((field) => !REPORT_MODERATION_FIELDS.has(field))
}

function evaluate(actor: Actor, action: Action, table: Table, context: AuthzContext): boolean {
  if (actor.kind === 'service') return true

  if (table === 'danger_reports') {
    if (action === 'select') {
      if (context.publicPreview) return true
      if (!isUser(actor)) return false
      return actor.isAdmin || isOwner(actor, context) || PUBLIC_REPORT_STATUSES.has(context.status ?? '')
    }
    if (!isUser(actor)) return false
    if (action === 'insert') {
      return actor.isAdmin || (isOwner(actor, context) && (!context.status || context.status === 'pending'))
    }
    if (action === 'update') {
      return actor.isAdmin || (isOwner(actor, context) && changesNoModerationField(context))
    }
    return actor.isAdmin || isOwner(actor, context)
  }

  if (table === 'profiles') {
    if (!isUser(actor)) return false
    if (action === 'select') return context.displayOnly === true || isOwner(actor, context) || actor.isAdmin
    if (action === 'insert') return isOwner(actor, context) && context.role === 'user'
    if (action === 'update') return isOwner(actor, context) && !(context.changedFields ?? []).includes('role')
    return false
  }

  if (SOCIAL_TABLES.has(table)) {
    if (!isUser(actor)) return false
    if (action === 'select') return context.aggregateOnly === true || isOwner(actor, context)
    if (action === 'insert' || action === 'delete') return isOwner(actor, context)
    return false
  }

  if (table === 'report_comments') {
    if (action === 'select') return context.reportPublic === true
    if (!isUser(actor)) return false
    if (action === 'insert' || action === 'update') return isOwner(actor, context)
    return action === 'delete' && (actor.isAdmin || isOwner(actor, context))
  }

  if (table === 'report_images') {
    if (action === 'select') return context.reportPublic === true || isOwner(actor, context) || (isUser(actor) && actor.isAdmin)
    if (!isUser(actor)) return false
    if (action === 'insert' || action === 'update') return isOwner(actor, context)
    return action === 'delete' && (actor.isAdmin || isOwner(actor, context))
  }

  if (OWNED_TABLES.has(table)) {
    return isOwner(actor, context)
  }

  if (table === 'user_points') {
    if (!isUser(actor) || action !== 'select') return false
    return context.leaderboard === true || isOwner(actor, context)
  }

  if (table === 'notifications') {
    if (!isUser(actor)) return false
    if (action === 'select' || action === 'delete') return isOwner(actor, context)
    if (action === 'update') {
      return isOwner(actor, context) && onlyChanges(context, new Set(['is_read']))
    }
    if (context.targetUserId === actor.id) return true
    return context.notificationType === 'route_report' && Boolean(context.reportId)
  }

  if (table === 'report_shares') {
    if (action === 'insert') {
      if (actor.kind === 'anon') return context.targetUserId == null
      return context.targetUserId == null || context.targetUserId === actor.id
    }
    return action === 'select' && isOwner(actor, context)
  }

  if (HUNTER_TABLES.has(table)) {
    if (action === 'update') return false
    return isOwner(actor, context)
  }

  if (REFERENCE_TABLES.has(table)) {
    return action === 'select' && isUser(actor)
  }

  if (table === 'local_safety_alerts') {
    return action === 'select'
  }

  if (OPERATIONAL_TABLES.has(table)) {
    if (!isUser(actor) || !actor.isAdmin) return false
    if (action === 'select') return true
    return table === 'api_budget_settings' && action === 'update'
  }

  return false
}

export function can(
  actor: Actor,
  action: Action,
  table: Table,
  context: AuthzContext = {},
): boolean {
  return evaluate(actor, action, table, context)
}

export function assertCan(
  actor: Actor,
  action: Action,
  table: Table,
  context: AuthzContext = {},
): void {
  if (!evaluate(actor, action, table, context)) {
    throw new AuthzError(action, table)
  }
}
