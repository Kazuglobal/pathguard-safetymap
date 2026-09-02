import { and, desc, eq, inArray } from 'drizzle-orm'

import { assertCan, type Actor } from '../authz'
import { getDb, type AppDb } from '../client'
import { hazardDetections, hunterAuditLog, hunterPhotos } from '../schema'

export interface HunterDetectionInput {
  type?: string | null
  kind?: string | null
  accidentLink?: string | null
  region?: Record<string, unknown> | null
  severity?: string | null
  kidExplanation?: string | null
  safeAction?: string | null
  confidence?: number | null
  model?: string | null
}

export function createHunterRepo(db: AppDb) {
  return {
    async savePhoto(actor: Actor, input: {
      id: string; imageKey: string; pinLat: number; pinLng: number; retentionUntil: string;
      detections: readonly HunterDetectionInput[]
    }) {
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      assertCan(actor, 'insert', 'hunter_photos', { ownerId: actor.id })
      if (input.detections.length > 50) throw new RangeError('Too many detections')
      const photoInsert = db.insert(hunterPhotos).values({
        id: input.id, playerId: actor.id, imageKey: input.imageKey,
        pinLat: input.pinLat, pinLng: input.pinLng, capturedAt: new Date().toISOString(),
        masked: true, exifStripped: true, retentionUntil: input.retentionUntil,
      })
      if (!input.detections.length) {
        await photoInsert
        return
      }
      assertCan(actor, 'insert', 'hazard_detections', { ownerId: actor.id })
      const detectionInsert = db.insert(hazardDetections).values(input.detections.map((detection) => ({
        id: crypto.randomUUID(), photoId: input.id, type: detection.type ?? null,
        kind: detection.kind ?? null, accidentLink: detection.accidentLink ?? null,
        region: detection.region ?? null, severity: detection.severity ?? null,
        kidExplanation: detection.kidExplanation ?? null, safeAction: detection.safeAction ?? null,
        confidence: detection.confidence ?? null, model: detection.model ?? null,
      })))
      await db.batch([photoInsert, detectionInsert])
    },

    async list(actor: Actor) {
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      assertCan(actor, 'select', 'hunter_photos', { ownerId: actor.id })
      const photos = await db.select().from(hunterPhotos).where(eq(hunterPhotos.playerId, actor.id))
        .orderBy(desc(hunterPhotos.createdAt)).limit(60)
      const detections = photos.length
        ? await db.select().from(hazardDetections).where(inArray(hazardDetections.photoId, photos.map((photo) => photo.id)))
        : []
      const byPhoto = new Map<string, typeof detections>()
      for (const detection of detections) {
        const rows = byPhoto.get(detection.photoId) ?? []
        rows.push(detection); byPhoto.set(detection.photoId, rows)
      }
      return photos.map((photo) => ({ photo, detections: byPhoto.get(photo.id) ?? [] }))
    },

    async get(actor: Actor, photoId: string) {
      const [photo] = await db.select().from(hunterPhotos).where(eq(hunterPhotos.id, photoId)).limit(1)
      if (!photo) return null
      assertCan(actor, 'select', 'hunter_photos', { ownerId: photo.playerId })
      return photo
    },

    /** 写真 1 枚と、その検出結果(再プレイ/ふりかえり用)。他人の写真は FORBIDDEN。 */
    async getWithDetections(actor: Actor, photoId: string) {
      const photo = await this.get(actor, photoId)
      if (!photo) return null
      assertCan(actor, 'select', 'hazard_detections', { ownerId: photo.playerId })
      const detections = await db.select().from(hazardDetections)
        .where(eq(hazardDetections.photoId, photo.id))
        .orderBy(hazardDetections.createdAt)
      return { photo, detections }
    },

    async delete(actor: Actor, photoId: string) {
      const photo = await this.get(actor, photoId)
      if (!photo) return null
      assertCan(actor, 'delete', 'hunter_photos', { ownerId: photo.playerId })
      await db.delete(hunterPhotos).where(and(eq(hunterPhotos.id, photoId), eq(hunterPhotos.playerId, photo.playerId)))
      return photo
    },

    async audit(actor: Actor, action: string, targetId: string) {
      const ownerId = actor.kind === 'user' ? actor.id : null
      assertCan(actor, 'insert', 'hunter_audit_log', { ownerId })
      await db.insert(hunterAuditLog).values({
        id: crypto.randomUUID(), actorId: ownerId, action: action.slice(0, 100), targetId: targetId.slice(0, 128),
      })
    },
  }
}

export function saveHunterPhoto(actor: Actor, input: Parameters<ReturnType<typeof createHunterRepo>['savePhoto']>[1]) {
  return createHunterRepo(getDb()).savePhoto(actor, input)
}
export function listHunterPhotos(actor: Actor) { return createHunterRepo(getDb()).list(actor) }
export function getHunterPhoto(actor: Actor, id: string) { return createHunterRepo(getDb()).get(actor, id) }
export function getHunterPhotoWithDetections(actor: Actor, id: string) {
  return createHunterRepo(getDb()).getWithDetections(actor, id)
}
export function deleteHunterPhoto(actor: Actor, id: string) { return createHunterRepo(getDb()).delete(actor, id) }
export function writeHunterAuditLog(actor: Actor, action: string, targetId: string) {
  return createHunterRepo(getDb()).audit(actor, action, targetId)
}
