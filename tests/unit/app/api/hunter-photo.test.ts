import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: vi.fn(),
}))

vi.mock("@/lib/hunter/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/hunter/storage")>()
  return {
    ...actual,
    deletePhotoObjects: vi.fn().mockResolvedValue(undefined),
    createPhotoSignedUrl: vi.fn(),
  }
})

vi.mock("@/lib/hunter/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

import { createServerClient } from "@/lib/supabase-server"
import { createPhotoSignedUrl, deletePhotoObjects } from "@/lib/hunter/storage"
import { writeAuditLog } from "@/lib/hunter/audit"

const OWNER_ID = "11111111-1111-1111-1111-111111111111"
const PHOTO_ID = "22222222-2222-2222-2222-222222222222"
const OTHER_PHOTO_ID = "33333333-3333-3333-3333-333333333333"

const mockUser = { id: OWNER_ID, email: "kid@example.com" }

interface BuilderConfig {
  singleResult?: { data: unknown; error: unknown }
  awaitResult?: { data?: unknown; error: unknown }
}

/**
 * Supabase クエリビルダの最小モック。
 * - select/eq/order/delete はチェーン用に同じビルダを返す。
 * - maybeSingle は singleResult を解決 (DELETE の所有者取得用)。
 * - ビルダ自体を await したとき (GET の一覧 / DELETE の delete 実行) は awaitResult を解決。
 */
function makeBuilder(config: BuilderConfig) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(config.singleResult ?? { data: null, error: null }),
    single: vi.fn().mockResolvedValue(config.singleResult ?? { data: null, error: null }),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(config.awaitResult ?? { data: [], error: null }).then(resolve),
  }
  return builder
}

function mockClient(user: typeof mockUser | null, config: BuilderConfig = {}) {
  const builder = makeBuilder(config)
  vi.mocked(createServerClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn(() => builder),
  } as any)
  return builder
}

function makeRequest(url: string, method: string) {
  return new NextRequest(url, { method })
}

describe("DELETE /api/hunter/photo/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requires auth (401)", async () => {
    mockClient(null)
    const { DELETE } = await import("@/app/api/hunter/photo/[id]/route")
    const res = await DELETE(
      makeRequest(`http://localhost/api/hunter/photo/${PHOTO_ID}`, "DELETE"),
      { params: Promise.resolve({ id: PHOTO_ID }) },
    )
    expect(res.status).toBe(401)
    expect(deletePhotoObjects).not.toHaveBeenCalled()
  })

  it("rejects a malformed photo id (400)", async () => {
    mockClient(mockUser)
    const { DELETE } = await import("@/app/api/hunter/photo/[id]/route")
    const res = await DELETE(
      makeRequest("http://localhost/api/hunter/photo/not-a-uuid", "DELETE"),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    )
    expect(res.status).toBe(400)
    expect(deletePhotoObjects).not.toHaveBeenCalled()
  })

  it("refuses to delete another user's photo (404, no leak)", async () => {
    // 行は存在するが player_id が別人 → 404、削除は呼ばれない。
    mockClient(mockUser, {
      singleResult: { data: { id: OTHER_PHOTO_ID, player_id: "99999999-9999-9999-9999-999999999999" }, error: null },
    })
    const { DELETE } = await import("@/app/api/hunter/photo/[id]/route")
    const res = await DELETE(
      makeRequest(`http://localhost/api/hunter/photo/${OTHER_PHOTO_ID}`, "DELETE"),
      { params: Promise.resolve({ id: OTHER_PHOTO_ID }) },
    )
    expect(res.status).toBe(404)
    expect(deletePhotoObjects).not.toHaveBeenCalled()
    expect(writeAuditLog).not.toHaveBeenCalled()
  })

  it("returns 404 when the photo does not exist", async () => {
    mockClient(mockUser, { singleResult: { data: null, error: null } })
    const { DELETE } = await import("@/app/api/hunter/photo/[id]/route")
    const res = await DELETE(
      makeRequest(`http://localhost/api/hunter/photo/${PHOTO_ID}`, "DELETE"),
      { params: Promise.resolve({ id: PHOTO_ID }) },
    )
    expect(res.status).toBe(404)
    expect(deletePhotoObjects).not.toHaveBeenCalled()
  })

  it("deletes the owner's photo (200) and writes an audit log", async () => {
    mockClient(mockUser, {
      singleResult: { data: { id: PHOTO_ID, player_id: OWNER_ID }, error: null },
      awaitResult: { error: null },
    })
    const { DELETE } = await import("@/app/api/hunter/photo/[id]/route")
    const res = await DELETE(
      makeRequest(`http://localhost/api/hunter/photo/${PHOTO_ID}`, "DELETE"),
      { params: Promise.resolve({ id: PHOTO_ID }) },
    )
    expect(res.status).toBe(200)
    expect(deletePhotoObjects).toHaveBeenCalledWith(expect.anything(), OWNER_ID, PHOTO_ID)
    expect(writeAuditLog).toHaveBeenCalledWith(expect.anything(), OWNER_ID, "delete_photo", PHOTO_ID)
  })
})

describe("GET /api/hunter/photos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requires auth (401)", async () => {
    mockClient(null)
    const { GET } = await import("@/app/api/hunter/photos/route")
    const res = await GET(makeRequest("http://localhost/api/hunter/photos", "GET"))
    expect(res.status).toBe(401)
  })

  it("returns the owner's photos with short-TTL signed URLs (no public URL)", async () => {
    mockClient(mockUser, {
      awaitResult: {
        data: [
          {
            id: PHOTO_ID,
            image_path: `${OWNER_ID}/${PHOTO_ID}/masked.webp`,
            pin_lat: 33.59,
            pin_lng: 130.4,
            captured_at: "2026-06-26T00:00:00.000Z",
            masked: true,
            retention_until: null,
            created_at: "2026-06-26T00:00:00.000Z",
          },
        ],
        error: null,
      },
    })
    vi.mocked(createPhotoSignedUrl).mockResolvedValue("https://signed.example/abc?token=xyz")

    const { GET } = await import("@/app/api/hunter/photos/route")
    const res = await GET(makeRequest("http://localhost/api/hunter/photos", "GET"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.photos).toHaveLength(1)
    expect(body.photos[0].signedUrl).toBe("https://signed.example/abc?token=xyz")
    expect(createPhotoSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      `${OWNER_ID}/${PHOTO_ID}/masked.webp`,
    )
    // 公開URL/生パスは漏らさない (image_path は応答に含めない)。
    expect(JSON.stringify(body)).not.toContain("image_path")
  })

  it("summarizes detected danger types (deduped) and the top severity", async () => {
    mockClient(mockUser, {
      awaitResult: {
        data: [
          {
            id: PHOTO_ID,
            image_path: `${OWNER_ID}/${PHOTO_ID}/masked.webp`,
            pin_lat: 33.59,
            pin_lng: 130.4,
            captured_at: "2026-06-26T00:00:00.000Z",
            masked: true,
            retention_until: null,
            created_at: "2026-06-26T00:00:00.000Z",
            hazard_detections: [
              { type: "見通しの悪い角", kind: "blind_corner", severity: "high" },
              { type: "車のかげ", kind: "parked_car_shadow", severity: "medium" },
              { type: "見通しの悪い角", kind: "blind_corner", severity: "high" },
            ],
          },
        ],
        error: null,
      },
    })
    vi.mocked(createPhotoSignedUrl).mockResolvedValue("https://signed.example/abc")

    const { GET } = await import("@/app/api/hunter/photos/route")
    const res = await GET(makeRequest("http://localhost/api/hunter/photos", "GET"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.photos[0].dangers).toEqual(["見通しの悪い角", "車のかげ"])
    expect(body.photos[0].topSeverity).toBe("high")
  })
})
