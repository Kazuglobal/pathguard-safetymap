import { describe, expect, it } from 'vitest'

import {
  AuthzError,
  assertCan,
  can,
  type Actor,
} from '@/lib/db/authz'

const anon: Actor = { kind: 'anon' }
const owner: Actor = { kind: 'user', id: 'user-1', email: 'owner@example.com', isAdmin: false }
const other: Actor = { kind: 'user', id: 'user-2', email: 'other@example.com', isAdmin: false }
const admin: Actor = { kind: 'user', id: 'admin-1', email: 'admin@example.com', isAdmin: true }
const service: Actor = { kind: 'service' }

describe('D1 authorization matrix', () => {
  it('limits anonymous danger report reads to the rounded public preview capability', () => {
    expect(can(anon, 'select', 'danger_reports', { publicPreview: true })).toBe(true)
    expect(can(anon, 'select', 'danger_reports', { status: 'published' })).toBe(false)
    expect(can(owner, 'select', 'danger_reports', { ownerId: owner.id, status: 'pending' })).toBe(true)
    expect(can(other, 'select', 'danger_reports', { ownerId: owner.id, status: 'pending' })).toBe(false)
    expect(can(other, 'select', 'danger_reports', { ownerId: owner.id, status: 'approved' })).toBe(true)
  })

  it('prevents owners from changing report moderation fields', () => {
    expect(can(owner, 'update', 'danger_reports', {
      ownerId: owner.id,
      changedFields: ['title'],
    })).toBe(true)
    expect(can(owner, 'update', 'danger_reports', {
      ownerId: owner.id,
      changedFields: ['status'],
    })).toBe(false)
    expect(can(admin, 'update', 'danger_reports', {
      ownerId: owner.id,
      changedFields: ['status'],
    })).toBe(true)
  })

  it('fixes profile role on insert and makes role immutable for users', () => {
    expect(can(owner, 'insert', 'profiles', {
      ownerId: owner.id,
      role: 'user',
    })).toBe(true)
    expect(can(owner, 'insert', 'profiles', {
      ownerId: owner.id,
      role: 'admin',
    })).toBe(false)
    expect(can(owner, 'update', 'profiles', {
      ownerId: owner.id,
      changedFields: ['role'],
    })).toBe(false)
  })

  it('scopes user-owned tables to the current user', () => {
    const ownedTables = [
      'report_likes',
      'report_bookmarks',
      'danger_report_reactions',
      'report_flags',
      'user_routes',
      'route_learning_sessions',
      'push_subscriptions',
      'user_badges',
      'user_mission_progress',
      'safety_quest_attempts',
    ] as const

    for (const table of ownedTables) {
      expect(can(owner, 'select', table, { ownerId: owner.id })).toBe(true)
      expect(can(other, 'select', table, { ownerId: owner.id })).toBe(false)
      expect(can(service, 'select', table, { ownerId: owner.id })).toBe(true)
    }
  })

  it('allows the explicit authenticated leaderboard projection but not anonymous access', () => {
    expect(can(owner, 'select', 'user_points', { leaderboard: true })).toBe(true)
    expect(can(anon, 'select', 'user_points', { leaderboard: true })).toBe(false)
    expect(can(other, 'select', 'user_points', { ownerId: owner.id })).toBe(false)
  })

  it('only allows user notification updates for is_read on their own row', () => {
    expect(can(owner, 'update', 'notifications', {
      ownerId: owner.id,
      changedFields: ['is_read'],
    })).toBe(true)
    expect(can(owner, 'update', 'notifications', {
      ownerId: owner.id,
      changedFields: ['content'],
    })).toBe(false)
    expect(can(other, 'update', 'notifications', {
      ownerId: owner.id,
      changedFields: ['is_read'],
    })).toBe(false)
  })

  it('allows cross-user route report notifications only with a report id', () => {
    expect(can(owner, 'insert', 'notifications', {
      targetUserId: other.id,
      notificationType: 'route_report',
      reportId: 'report-1',
    })).toBe(true)
    expect(can(owner, 'insert', 'notifications', {
      targetUserId: other.id,
      notificationType: 'arbitrary',
      reportId: 'report-1',
    })).toBe(false)
    expect(can(owner, 'insert', 'notifications', {
      targetUserId: other.id,
      notificationType: 'route_report',
    })).toBe(false)
  })

  it('allows anonymous share inserts only when user_id is null', () => {
    expect(can(anon, 'insert', 'report_shares', { targetUserId: null })).toBe(true)
    expect(can(anon, 'insert', 'report_shares', { targetUserId: owner.id })).toBe(false)
    expect(can(owner, 'insert', 'report_shares', { targetUserId: owner.id })).toBe(true)
  })

  it('keeps operational tables service-only, with the documented budget admin exception', () => {
    const serviceTables = [
      'image_generation_gate_log',
      'api_usage_logs',
      'danger_report_moderation_log',
    ] as const

    for (const table of serviceTables) {
      expect(can(owner, 'select', table)).toBe(false)
      expect(can(admin, 'select', table)).toBe(true)
      expect(can(service, 'insert', table)).toBe(true)
    }

    expect(can(admin, 'update', 'api_budget_settings')).toBe(true)
    expect(can(owner, 'update', 'api_budget_settings')).toBe(false)
  })

  it('throws a stable 403 error from assertCan', () => {
    expect(() => assertCan(anon, 'delete', 'danger_reports', { ownerId: owner.id }))
      .toThrowError(AuthzError)

    try {
      assertCan(anon, 'delete', 'danger_reports', { ownerId: owner.id })
    } catch (error) {
      expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' })
    }
  })
})
