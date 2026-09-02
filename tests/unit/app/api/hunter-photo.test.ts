import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(),
  getPhoto: vi.fn(),
  deletePhoto: vi.fn(),
  listPhotos: vi.fn(),
  getWithDetections: vi.fn(),
  listAttempts: vi.fn(),
  putAnswerKey: vi.fn(),
  deleteObjects: vi.fn(),
  mediaUrl: vi.fn(),
  audit: vi.fn(),
  rateLimit: vi.fn(),
}))

vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.getActor }))
vi.mock('@/lib/db/repos/hunter.repo', () => ({
  getHunterPhoto: mocks.getPhoto,
  deleteHunterPhoto: mocks.deletePhoto,
  listHunterPhotos: mocks.listPhotos,
  getHunterPhotoWithDetections: mocks.getWithDetections,
}))
vi.mock('@/lib/db/repos/gamification.repo', () => ({
  listHunterAttempts: mocks.listAttempts,
}))
vi.mock('@/lib/hunter/answer-cache', () => ({
  putAnswerKey: mocks.putAnswerKey,
}))
vi.mock('@/lib/hunter/storage', () => ({
  deletePhotoObjects: mocks.deleteObjects,
  createPhotoSignedUrl: mocks.mediaUrl,
}))
vi.mock('@/lib/hunter/audit', () => ({ writeAuditLog: mocks.audit }))
vi.mock('@/lib/upstash-rate-limiter', async () => {
  const actual = await vi.importActual<typeof import('@/lib/upstash-rate-limiter')>('@/lib/upstash-rate-limiter')
  return { ...actual, checkApiRateLimit: mocks.rateLimit }
})

import { DELETE, GET as GET_PHOTO } from '@/app/api/hunter/photo/[id]/route'
import { GET } from '@/app/api/hunter/photos/route'

const OWNER_ID = '11111111-1111-4111-8111-111111111111'
const PHOTO_ID = '22222222-2222-4222-8222-222222222222'
const actor = { kind: 'user' as const, id: OWNER_ID, email: 'kid@example.com', isAdmin: false }
const imageKey = `hunter-photos/${OWNER_ID}/${PHOTO_ID}/masked.webp`

function request(url: string, method = 'GET') {
  return new NextRequest(url, { method })
}

describe('hunter photo D1 + R2 routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getActor.mockResolvedValue(actor)
    mocks.getPhoto.mockResolvedValue({ id: PHOTO_ID, playerId: OWNER_ID, imageKey })
    mocks.deletePhoto.mockResolvedValue({ id: PHOTO_ID })
    mocks.rateLimit.mockResolvedValue({ success: true })
    mocks.listPhotos.mockResolvedValue([])
    mocks.listAttempts.mockResolvedValue([])
    mocks.putAnswerKey.mockResolvedValue(undefined)
    mocks.getWithDetections.mockResolvedValue({
      photo: {
        id: PHOTO_ID, playerId: OWNER_ID, imageKey, pinLat: 33.59, pinLng: 130.4,
        capturedAt: '2026-06-26T00:00:00.000Z', retentionUntil: '2026-09-24T00:00:00.000Z',
      },
      detections: [
        { type: '見通しの悪い角', kind: 'blind_corner', accidentLink: '出会い頭', region: { x: 0.4, y: 0.5, w: 0.2, h: 0.2 }, severity: 'high', kidExplanation: 'みぎの かどが 見えないよ', safeAction: 'とまって みぎを 見よう', confidence: 0.9 },
        { type: 'こわれた行', kind: null, accidentLink: null, region: null, severity: 'high', kidExplanation: 'x', safeAction: 'y', confidence: 0.5 },
      ],
    })
    mocks.deleteObjects.mockResolvedValue(undefined)
    mocks.audit.mockResolvedValue(undefined)
    mocks.mediaUrl.mockReturnValue(`/api/media/private/${imageKey}`)
  })

  it('requires authentication for delete and list', async () => {
    mocks.getActor.mockResolvedValue({ kind: 'anon' })
    const deleted = await DELETE(request(`http://localhost/api/hunter/photo/${PHOTO_ID}`, 'DELETE'), {
      params: Promise.resolve({ id: PHOTO_ID }),
    })
    const listed = await GET(request('http://localhost/api/hunter/photos'))
    expect(deleted.status).toBe(401)
    expect(listed.status).toBe(401)
    expect(mocks.deleteObjects).not.toHaveBeenCalled()
  })

  it('rejects malformed IDs before loading D1', async () => {
    const response = await DELETE(request('http://localhost/api/hunter/photo/not-a-uuid', 'DELETE'), {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    })
    expect(response.status).toBe(400)
    expect(mocks.getPhoto).not.toHaveBeenCalled()
  })

  it('conceals missing or unauthorized photos as 404', async () => {
    mocks.getPhoto.mockRejectedValueOnce(new Error('Forbidden'))
    const response = await DELETE(request(`http://localhost/api/hunter/photo/${PHOTO_ID}`, 'DELETE'), {
      params: Promise.resolve({ id: PHOTO_ID }),
    })
    expect(response.status).toBe(404)
    expect(mocks.deleteObjects).not.toHaveBeenCalled()
    expect(mocks.audit).not.toHaveBeenCalled()
  })

  it('deletes the exact private object, then its D1 row, and audits it', async () => {
    const response = await DELETE(request(`http://localhost/api/hunter/photo/${PHOTO_ID}`, 'DELETE'), {
      params: Promise.resolve({ id: PHOTO_ID }),
    })
    expect(response.status).toBe(200)
    expect(mocks.getPhoto).toHaveBeenCalledWith(actor, PHOTO_ID)
    expect(mocks.deleteObjects).toHaveBeenCalledWith(OWNER_ID, PHOTO_ID)
    expect(mocks.deletePhoto).toHaveBeenCalledWith(actor, PHOTO_ID)
    expect(mocks.audit).toHaveBeenCalledWith(actor, 'delete_photo', PHOTO_ID)
  })

  it('replays a saved photo: rebuilds hazards, issues a fresh server-held answer key, no image key leak', async () => {
    const response = await GET_PHOTO(request(`http://localhost/api/hunter/photo/${PHOTO_ID}`), {
      params: Promise.resolve({ id: PHOTO_ID }),
    })
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.photoId).toBe(PHOTO_ID)
    expect(body.signedUrl).toBe(`/api/media/private/${imageKey}`)
    expect(body.pin).toEqual({ latitude: 33.59, longitude: 130.4 })
    expect(body.retentionUntil).toBe('2026-09-24T00:00:00.000Z')
    expect(body.hazards).toHaveLength(1)
    expect(body.hazards[0]).toMatchObject({
      id: `${body.sessionId}-0`, kind: 'blind_corner', accidentLink: '出会い頭', severity: 'high',
      region: { x: 0.4, y: 0.5, w: 0.2, h: 0.2 },
    })
    expect(mocks.putAnswerKey).toHaveBeenCalledWith(body.sessionId, {
      hazards: [{ id: `${body.sessionId}-0`, region: { x: 0.4, y: 0.5, w: 0.2, h: 0.2 }, severity: 'high', confidence: 0.9 }],
      quiz: [],
    })
    expect(mocks.audit).toHaveBeenCalledWith(actor, 'replay_photo', PHOTO_ID)
    expect(JSON.stringify(body)).not.toContain('imageKey')
  })

  it('rate-limits replay and listing so a loop cannot mint answer keys or audit rows', async () => {
    mocks.rateLimit.mockResolvedValue({ success: false, reset: Date.now() + 60_000 })
    const replay = await GET_PHOTO(request(`http://localhost/api/hunter/photo/${PHOTO_ID}`), {
      params: Promise.resolve({ id: PHOTO_ID }),
    })
    const listed = await GET(request('http://localhost/api/hunter/photos'))
    expect(replay.status).toBe(429)
    expect(listed.status).toBe(429)
    expect(mocks.putAnswerKey).not.toHaveBeenCalled()
    expect(mocks.getWithDetections).not.toHaveBeenCalled()
  })

  it('conceals other players\' photos from replay as 404 and issues no key', async () => {
    mocks.getWithDetections.mockRejectedValueOnce(new Error('Forbidden'))
    const response = await GET_PHOTO(request(`http://localhost/api/hunter/photo/${PHOTO_ID}`), {
      params: Promise.resolve({ id: PHOTO_ID }),
    })
    expect(response.status).toBe(404)
    expect(mocks.putAnswerKey).not.toHaveBeenCalled()

    mocks.getActor.mockResolvedValueOnce({ kind: 'anon' })
    const anon = await GET_PHOTO(request(`http://localhost/api/hunter/photo/${PHOTO_ID}`), {
      params: Promise.resolve({ id: PHOTO_ID }),
    })
    expect(anon.status).toBe(401)
  })

  it('attaches per-photo play stats from hunter attempts and tolerates their failure', async () => {
    const row = {
      photo: {
        id: PHOTO_ID, playerId: OWNER_ID, imageKey, pinLat: 33.59, pinLng: 130.4,
        capturedAt: '2026-06-26T00:00:00.000Z', masked: true, retentionUntil: null, createdAt: '2026-06-26T00:00:00.000Z',
      },
      detections: [],
    }
    mocks.listPhotos.mockResolvedValue([row])
    mocks.listAttempts.mockResolvedValue([
      { answerPayload: { source: 'hunter', mode: 'explore', photoId: PHOTO_ID, matches: 2, total: 3 }, createdAt: '2026-09-02T00:00:00.000Z' },
      { answerPayload: { source: 'hunter', mode: 'quiz', photoId: PHOTO_ID, matches: 1, total: 1 }, createdAt: '2026-09-01T00:00:00.000Z' },
    ])
    const ok = await (await GET(request('http://localhost/api/hunter/photos'))).json()
    expect(ok.photos[0].plays).toEqual({ count: 2, bestFound: 2, bestTotal: 3, lastPlayedAt: '2026-09-02T00:00:00.000Z' })

    mocks.listAttempts.mockRejectedValueOnce(new Error('D1 down'))
    const degraded = await GET(request('http://localhost/api/hunter/photos'))
    expect(degraded.status).toBe(200)
    expect((await degraded.json()).photos[0].plays).toBeNull()
  })

  it('returns only private media routes and summarized detections', async () => {
    mocks.listPhotos.mockResolvedValue([{
      photo: {
        id: PHOTO_ID,
        playerId: OWNER_ID,
        imageKey,
        pinLat: 33.59,
        pinLng: 130.4,
        capturedAt: '2026-06-26T00:00:00.000Z',
        masked: true,
        retentionUntil: null,
        createdAt: '2026-06-26T00:00:00.000Z',
      },
      detections: [
        { type: '見通しの悪い角', severity: 'high' },
        { type: '車のかげ', severity: 'medium' },
        { type: '見通しの悪い角', severity: 'high' },
      ],
    }])

    const response = await GET(request('http://localhost/api/hunter/photos'))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.photos[0]).toMatchObject({
      id: PHOTO_ID,
      signedUrl: `/api/media/private/${imageKey}`,
      dangers: ['見通しの悪い角', '車のかげ'],
      topSeverity: 'high',
    })
    expect(mocks.mediaUrl).toHaveBeenCalledWith(imageKey)
    expect(JSON.stringify(body)).not.toContain('imageKey')
  })
})
