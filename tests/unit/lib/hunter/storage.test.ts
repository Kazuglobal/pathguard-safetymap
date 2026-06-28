import { describe, expect, it, vi } from "vitest"

import {
  HUNTER_PHOTO_BUCKET,
  createPhotoSignedUrl,
  deletePhotoObjects,
  photoStoragePath,
  uploadMaskedPhoto,
} from "@/lib/hunter/storage"
import { parsePhotoId } from "@/lib/hunter/validation"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const PHOTO_ID = "22222222-2222-4222-8222-222222222222"
const MASKED_DATA_URL = "data:image/webp;base64,AAAA"

/** Supabase storage クライアントの最小モックを生成する。 */
function makeStorageClient(handlers: {
  upload?: ReturnType<typeof vi.fn>
  createSignedUrl?: ReturnType<typeof vi.fn>
  list?: ReturnType<typeof vi.fn>
  remove?: ReturnType<typeof vi.fn>
}) {
  const from = vi.fn().mockReturnValue({
    upload: handlers.upload ?? vi.fn(),
    createSignedUrl: handlers.createSignedUrl ?? vi.fn(),
    list: handlers.list ?? vi.fn(),
    remove: handlers.remove ?? vi.fn(),
  })
  return {
    client: { storage: { from } } as any,
    from,
  }
}

describe("photoStoragePath", () => {
  it("所有者スコープのパスを組み立てる", () => {
    expect(photoStoragePath(USER_ID, PHOTO_ID)).toBe(`${USER_ID}/${PHOTO_ID}/masked.webp`)
  })
})

describe("uploadMaskedPhoto", () => {
  it("成功時にパスを返し contentType と upsert:false で upload する", async () => {
    const upload = vi.fn().mockResolvedValue({ data: { path: "x" }, error: null })
    const { client, from } = makeStorageClient({ upload })

    const result = await uploadMaskedPhoto(client, USER_ID, PHOTO_ID, MASKED_DATA_URL)

    expect(result.path).toBe(`${USER_ID}/${PHOTO_ID}/masked.webp`)
    expect(from).toHaveBeenCalledWith(HUNTER_PHOTO_BUCKET)
    expect(upload).toHaveBeenCalledTimes(1)
    const [, bytes, options] = upload.mock.calls[0]
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(options).toMatchObject({ contentType: "image/webp", upsert: false })
  })

  it("jpeg は拒否する (webp 限定・EXIF/位置情報の残存防止)", async () => {
    const upload = vi.fn()
    const { client } = makeStorageClient({ upload })

    await expect(
      uploadMaskedPhoto(client, USER_ID, PHOTO_ID, "data:image/jpeg;base64,AAAA"),
    ).rejects.toThrow(/webp/)
    expect(upload).not.toHaveBeenCalled()
  })

  it("upload エラー時に throw する", async () => {
    const upload = vi.fn().mockResolvedValue({ data: null, error: { message: "denied" } })
    const { client } = makeStorageClient({ upload })

    await expect(uploadMaskedPhoto(client, USER_ID, PHOTO_ID, MASKED_DATA_URL)).rejects.toThrow(
      /保存に失敗/,
    )
  })

  it("dataURL でない場合は throw する", async () => {
    const { client } = makeStorageClient({})
    await expect(uploadMaskedPhoto(client, USER_ID, PHOTO_ID, "not-a-data-url")).rejects.toThrow(
      /形式が正しくありません/,
    )
  })

  it("未対応の MIME (png) は throw する", async () => {
    const { client } = makeStorageClient({})
    await expect(
      uploadMaskedPhoto(client, USER_ID, PHOTO_ID, "data:image/png;base64,AAAA"),
    ).rejects.toThrow(/webp/)
  })
})

describe("createPhotoSignedUrl", () => {
  it("成功時に署名URLを返す", async () => {
    const createSignedUrl = vi
      .fn()
      .mockResolvedValue({ data: { signedUrl: "https://signed.example/x" }, error: null })
    const { client, from } = makeStorageClient({ createSignedUrl })

    const url = await createPhotoSignedUrl(client, photoStoragePath(USER_ID, PHOTO_ID))

    expect(url).toBe("https://signed.example/x")
    expect(from).toHaveBeenCalledWith(HUNTER_PHOTO_BUCKET)
    expect(createSignedUrl).toHaveBeenCalledWith(`${USER_ID}/${PHOTO_ID}/masked.webp`, 300)
  })

  it("任意の TTL を渡せる", async () => {
    const createSignedUrl = vi
      .fn()
      .mockResolvedValue({ data: { signedUrl: "https://signed.example/x" }, error: null })
    const { client } = makeStorageClient({ createSignedUrl })

    await createPhotoSignedUrl(client, "p", 60)

    expect(createSignedUrl).toHaveBeenCalledWith("p", 60)
  })

  it("エラー時は throw せず null を返す", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: null, error: { message: "no" } })
    const { client } = makeStorageClient({ createSignedUrl })

    const url = await createPhotoSignedUrl(client, "p")

    expect(url).toBeNull()
  })
})

describe("deletePhotoObjects", () => {
  it("配下を列挙してフルパスで remove する", async () => {
    const list = vi
      .fn()
      .mockResolvedValue({ data: [{ name: "masked.webp" }], error: null })
    const remove = vi.fn().mockResolvedValue({ data: [], error: null })
    const { client, from } = makeStorageClient({ list, remove })

    await deletePhotoObjects(client, USER_ID, PHOTO_ID)

    expect(from).toHaveBeenCalledWith(HUNTER_PHOTO_BUCKET)
    expect(list).toHaveBeenCalledWith(`${USER_ID}/${PHOTO_ID}`)
    expect(remove).toHaveBeenCalledWith([`${USER_ID}/${PHOTO_ID}/masked.webp`])
  })

  it("配下が空なら remove しない", async () => {
    const list = vi.fn().mockResolvedValue({ data: [], error: null })
    const remove = vi.fn()
    const { client } = makeStorageClient({ list, remove })

    await deletePhotoObjects(client, USER_ID, PHOTO_ID)

    expect(remove).not.toHaveBeenCalled()
  })

  it("list エラー時に throw する", async () => {
    const list = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } })
    const { client } = makeStorageClient({ list })

    await expect(deletePhotoObjects(client, USER_ID, PHOTO_ID)).rejects.toThrow(/一覧取得に失敗/)
  })

  it("remove エラー時に throw する", async () => {
    const list = vi.fn().mockResolvedValue({ data: [{ name: "masked.webp" }], error: null })
    const remove = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } })
    const { client } = makeStorageClient({ list, remove })

    await expect(deletePhotoObjects(client, USER_ID, PHOTO_ID)).rejects.toThrow(/削除に失敗/)
  })
})

describe("parsePhotoId", () => {
  it("正しい UUID を受け付ける", () => {
    expect(parsePhotoId(PHOTO_ID)).toEqual({ ok: true, id: PHOTO_ID })
  })

  it("UUID 形式でない文字列は拒否する", () => {
    const result = parsePhotoId("not-a-uuid")
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it("文字列でない値は拒否する", () => {
    expect(parsePhotoId(123).ok).toBe(false)
    expect(parsePhotoId(null).ok).toBe(false)
    expect(parsePhotoId(undefined).ok).toBe(false)
  })
})
