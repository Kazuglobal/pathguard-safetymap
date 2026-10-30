// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(),
  collect: vi.fn(),
  deleteRows: vi.fn(),
  privateDelete: vi.fn(),
  publicDelete: vi.fn(),
  privateList: vi.fn(),
  publicList: vi.fn(),
  deleteUser: vi.fn(),
  order: [] as string[],
}))

vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.getActor }))
vi.mock('@/lib/db/client', () => ({ getDb: () => ({}) }))
vi.mock('@/lib/account-deletion', async (original) => ({
  ...await original<typeof import('@/lib/account-deletion')>(),
  collectAccountMediaKeys: mocks.collect,
  deleteAccountRows: mocks.deleteRows,
}))
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => ({ auth: { admin: { deleteUser: mocks.deleteUser } } }) }))
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({ env: {
    MEDIA_PRIVATE: { delete: mocks.privateDelete, list: mocks.privateList },
    MEDIA_PUBLIC: { delete: mocks.publicDelete, list: mocks.publicList },
  } }),
}))

import { DELETE } from '@/app/api/account/route'

const user = { kind: 'user' as const, id: 'user-me', email: null, isAdmin: false }

function request(body: unknown) {
  return new Request('https://path-guardian.com/api/account', { method: 'DELETE', body: JSON.stringify(body) })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.order.length = 0
  mocks.getActor.mockResolvedValue(user)
  mocks.collect.mockImplementation(async () => { mocks.order.push('collect'); return { privateKeys: ['danger-reports/user-me/r/m-a.webp'], publicKeys: ['avatars/user-me/i.webp'] } })
  mocks.privateDelete.mockImplementation(async () => { mocks.order.push('r2-private') })
  mocks.publicDelete.mockImplementation(async () => { mocks.order.push('r2-public') })
  mocks.deleteRows.mockImplementation(async () => { mocks.order.push('d1') })
  mocks.privateList.mockResolvedValue({ objects: [], truncated: false })
  mocks.publicList.mockResolvedValue({ objects: [], truncated: false })
  mocks.deleteUser.mockImplementation(async () => { mocks.order.push('supabase'); return { error: null } })
})

describe('DELETE /api/account(UIUX改装 項目40)', () => {
  it('デモのアカウントは、ほかの人も使うので消させない(何も消さずに 403)', async () => {
    mocks.getActor.mockResolvedValue({ ...user, email: 'Demo@Example.com' })

    const response = await DELETE(request({ confirm: 'さくじょ' }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'デモのアカウントは、ほかの人も使うため削除できません。' })
    expect(mocks.collect).not.toHaveBeenCalled()
    expect(mocks.deleteRows).not.toHaveBeenCalled()
    expect(mocks.deleteUser).not.toHaveBeenCalled()
  })

  it('「さくじょ」の確認があれば、写真 → D1 → アカウントの順に消す', async () => {
    const response = await DELETE(request({ confirm: 'さくじょ' }))

    expect(response.status).toBe(200)
    expect(mocks.order).toEqual(['collect', 'r2-private', 'r2-public', 'd1', 'supabase'])
    expect(mocks.privateDelete).toHaveBeenCalledWith(['danger-reports/user-me/r/m-a.webp'])
    expect(mocks.deleteRows).toHaveBeenCalledWith(expect.anything(), 'user-me')
    expect(mocks.deleteUser).toHaveBeenCalledWith('user-me')
  })

  it('D1 から参照されなくなった写真(差し替えで消し損ねた、ぼかす前の写真など)も、本人のフォルダから消す', async () => {
    mocks.privateList.mockImplementation(async ({ prefix, cursor }: { prefix: string; cursor?: string }) => {
      if (prefix === 'danger-reports/user-me/' && !cursor) return { objects: [{ key: 'danger-reports/user-me/r/orphan-original.webp' }], truncated: true, cursor: 'next' }
      if (prefix === 'danger-reports/user-me/') return { objects: [{ key: 'danger-reports/user-me/r2/orphan.webp' }], truncated: false }
      if (prefix === 'hunter-photos/user-me/') return { objects: [{ key: 'hunter-photos/user-me/p/masked.webp' }], truncated: false }
      return { objects: [], truncated: false }
    })

    expect((await DELETE(request({ confirm: 'さくじょ' }))).status).toBe(200)

    expect(mocks.privateList.mock.calls.map(([options]) => options.prefix)).toEqual(['danger-reports/user-me/', 'danger-reports/user-me/', 'hunter-photos/user-me/'])
    expect(mocks.publicList).toHaveBeenCalledWith({ prefix: 'avatars/user-me/', cursor: undefined })
    const deleted = mocks.privateDelete.mock.calls.flatMap(([keys]) => keys as string[])
    expect(deleted).toEqual(expect.arrayContaining([
      'danger-reports/user-me/r/orphan-original.webp', 'danger-reports/user-me/r2/orphan.webp', 'hunter-photos/user-me/p/masked.webp',
    ]))
  })

  it('確認の文字が違えば何も消さない', async () => {
    for (const body of [{}, { confirm: '削除' }, { confirm: 'さくじょ ' }]) {
      expect((await DELETE(request(body))).status).toBe(400)
    }
    expect(mocks.order).toEqual([])
  })

  it('ログインしていなければ消さない', async () => {
    mocks.getActor.mockResolvedValue({ kind: 'anon' })
    expect((await DELETE(request({ confirm: 'さくじょ' }))).status).toBe(401)
    expect(mocks.order).toEqual([])
  })

  it('写真を消せなかったら D1 もアカウントも消さない(流し直せば写真のキーが分かる)', async () => {
    mocks.privateDelete.mockRejectedValue(new Error('r2 down'))

    const response = await DELETE(request({ confirm: 'さくじょ' }))

    expect(response.status).toBe(500)
    expect(mocks.deleteRows).not.toHaveBeenCalled()
    expect(mocks.deleteUser).not.toHaveBeenCalled()
  })

  it('アカウントを消せなかったら 500 で知らせる(D1 は消えているので、流し直すとアカウントだけを消す)', async () => {
    mocks.deleteUser.mockResolvedValue({ error: { status: 500, message: 'boom' } })

    const response = await DELETE(request({ confirm: 'さくじょ' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('もう一度') })
  })
})
