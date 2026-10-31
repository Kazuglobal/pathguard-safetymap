// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'
import type { PersonalMetadataScrub } from '@/lib/privacy/personal-metadata'
import {
  main,
  NAME_SCRUB_CONFIRM_ENV,
  scanAuthUsers,
  type AuthAdminPort,
  type AuthUserRecord,
} from '@/scripts/ops/scrub-personal-names'

import { createFakeWrangler, createTestDeps } from './ops-fake-wrangler'

interface FakeAuth extends AuthAdminPort {
  readonly users: Map<string, Record<string, unknown>>
  readonly updates: Array<{ userId: string; metadata: PersonalMetadataScrub }>
}

/** Supabase の updateUserById と同じく、user_metadata に重ねて保存し、null のキーは消す */
function createFakeAuth(initial: readonly AuthUserRecord[], options: { failFor?: string } = {}): FakeAuth {
  const users = new Map(initial.map((user) => [user.id, { ...(user.user_metadata ?? {}) }]))
  const updates: Array<{ userId: string; metadata: PersonalMetadataScrub }> = []
  return {
    users,
    updates,
    async listUsers(page, perPage) {
      return [...users.entries()]
        .slice((page - 1) * perPage, page * perPage)
        .map(([id, metadata]) => ({ id, user_metadata: { ...metadata } }))
    },
    async updateUserMetadata(userId, metadata) {
      updates.push({ userId, metadata })
      if (userId === options.failFor) throw new Error('rate limited')
      const current = users.get(userId) ?? {}
      const next = { ...current }
      for (const [key, value] of Object.entries(metadata)) {
        if (value === null) delete next[key]
        else next[key] = value
      }
      users.set(userId, next)
    },
  }
}

const GOOGLE_USER: AuthUserRecord = {
  id: '00000000-0000-4000-8000-000000000001',
  user_metadata: { email: 'google@example.com', name: '山田 花子', full_name: '山田 花子', avatar_url: 'https://lh3/a', picture: 'https://lh3/a' },
}
const LINE_USER: AuthUserRecord = {
  id: '00000000-0000-4000-8000-000000000002',
  user_metadata: { provider: 'line', line_user_id: 'U-line', name: 'はなこ', full_name: 'はなこ', avatar_url: 'https://line/a' },
}
const EMAIL_USER: AuthUserRecord = {
  id: '00000000-0000-4000-8000-000000000003',
  user_metadata: { full_name: '鈴木 一郎' },
}
const CLEAN_USER: AuthUserRecord = {
  id: '00000000-0000-4000-8000-000000000004',
  user_metadata: { provider: 'line', line_user_id: 'U-clean' },
}

let database: TestDatabase

function addProfile(id: string, fullName: string | null) {
  database.sqlite.prepare('insert into profiles (id, email, display_name, full_name) values (?, ?, ?, ?)')
    .run(id, `${id}@example.com`, 'ニックネーム', fullName)
}

function countFullNames(): number {
  return (database.sqlite.prepare('select count(*) as n from profiles where full_name is not null').get() as { n: number }).n
}

beforeEach(() => {
  database = createTestDatabase()
  // テストの D1 は列を消すマイグレーション(20261029235818)まで当たっている。
  // このスクリプトは列を消す前の本番に流したので、その形(full_name の列がある)にもどして確かめる
  database.sqlite.exec('ALTER TABLE profiles ADD COLUMN full_name text')
  addProfile(GOOGLE_USER.id, '山田 花子')
  addProfile(EMAIL_USER.id, '鈴木 一郎')
  addProfile(CLEAN_USER.id, null)
})

afterEach(() => {
  database.sqlite.close()
})

describe('scanAuthUsers', () => {
  it('全ページを読み、消す必要のある人だけを集める', async () => {
    const many = Array.from({ length: 1001 }, (_, index) => ({
      id: `user-${index}`,
      user_metadata: index === 1000 ? { full_name: '最後のページの人' } : {},
    }))
    const scan = await scanAuthUsers(createFakeAuth(many))

    expect(scan.totalUsers).toBe(1001)
    expect(scan.targets).toEqual([{ userId: 'user-1000', patch: { full_name: null } }])
  })
})

describe('scrub-personal-names main', () => {
  const allUsers = [GOOGLE_USER, LINE_USER, EMAIL_USER, CLEAN_USER]

  it('ドライランは件数だけを表示し、何も書き換えない(名前・メール・id は出さない)', async () => {
    const auth = createFakeAuth(allUsers)
    const wrangler = createFakeWrangler(database.sqlite)
    const deps = createTestDeps({ runner: wrangler.runner })

    const code = await main([], deps, auth)

    expect(code).toBe(0)
    expect(auth.updates).toEqual([])
    expect(countFullNames()).toBe(2)
    const output = [...deps.lines, ...deps.errors].join('\n')
    expect(output).toContain('名前・顔写真が残っている人 3 人')
    expect(output).toContain('full_name 3 / name 2 / avatar_url 2 / picture 1')
    expect(output).toContain('入っている行 2 件')
    for (const secret of ['山田', 'はなこ', '鈴木', '@example.com', 'U-line', GOOGLE_USER.id, 'https://']) {
      expect(output).not.toContain(secret)
    }
  })

  it('--apply だけでは書き換えない(確認用の環境変数が要る)', async () => {
    const auth = createFakeAuth(allUsers)
    const deps = createTestDeps({ runner: createFakeWrangler(database.sqlite).runner })

    const code = await main(['--apply'], deps, auth)

    expect(code).toBe(1)
    expect(deps.errors.join('\n')).toContain(NAME_SCRUB_CONFIRM_ENV)
    expect(auth.updates).toEqual([])
    expect(countFullNames()).toBe(2)
  })

  it('--apply と確認で、名前・顔写真と D1 の氏名を消し、ログインに使う値と表示名は残す', async () => {
    const auth = createFakeAuth(allUsers)
    const deps = createTestDeps({ runner: createFakeWrangler(database.sqlite).runner, env: { [NAME_SCRUB_CONFIRM_ENV]: 'yes' } })

    const code = await main(['--apply'], deps, auth)

    expect(code).toBe(0)
    expect(countFullNames()).toBe(0)
    expect(auth.users.get(GOOGLE_USER.id)).toEqual({ email: 'google@example.com' })
    expect(auth.users.get(LINE_USER.id)).toEqual({ provider: 'line', line_user_id: 'U-line' })
    expect(auth.users.get(EMAIL_USER.id)).toEqual({})
    // 消すものが無い人には更新の API を呼ばない
    expect(auth.updates.map((update) => update.userId)).not.toContain(CLEAN_USER.id)
    const displayNames = database.sqlite.prepare('select count(*) as n from profiles where display_name = ?').get('ニックネーム') as { n: number }
    expect(displayNames.n).toBe(3)
    expect(deps.lines.join('\n')).toContain('数え直し: Supabase Auth に残っている人 0 人 / D1 の氏名 0 件')
  })

  it('一部の更新に失敗したら終了コード 1 で知らせ、流し直すと残りだけを消す', async () => {
    const auth = createFakeAuth(allUsers, { failFor: LINE_USER.id })
    const deps = createTestDeps({ runner: createFakeWrangler(database.sqlite).runner, env: { [NAME_SCRUB_CONFIRM_ENV]: 'yes' } })

    expect(await main(['--apply'], deps, auth)).toBe(1)
    expect(deps.lines.join('\n')).toContain('失敗: 1 人')
    expect(deps.errors.join('\n')).toContain('消し残りがあります')

    const retry = createFakeAuth([...auth.users.entries()].map(([id, metadata]) => ({ id, user_metadata: metadata })))
    const retryDeps = createTestDeps({ runner: createFakeWrangler(database.sqlite).runner, env: { [NAME_SCRUB_CONFIRM_ENV]: 'yes' } })
    expect(await main(['--apply'], retryDeps, retry)).toBe(0)
    expect(retry.updates.map((update) => update.userId)).toEqual([LINE_USER.id])
  })

  it('D1 の full_name の列をマイグレーションで消したあとでも、Supabase の分だけを消せる', async () => {
    database.sqlite.exec('ALTER TABLE profiles DROP COLUMN full_name')
    const auth = createFakeAuth(allUsers)
    const deps = createTestDeps({ runner: createFakeWrangler(database.sqlite).runner, env: { [NAME_SCRUB_CONFIRM_ENV]: 'yes' } })

    const code = await main(['--apply'], deps, auth)

    expect(code).toBe(0)
    expect(deps.lines.join('\n')).toContain('D1 profiles.full_name: 列はもう消してあります')
    expect(deps.lines.join('\n')).not.toContain('D1 の氏名を消します')
    expect(auth.users.get(EMAIL_USER.id)).toEqual({})
    expect(deps.lines.join('\n')).toContain('数え直し: Supabase Auth に残っている人 0 人 / D1 の氏名 0 件')
  })

  it('D1 に profiles の表そのものが無い(接続先の取り違えなど)ときは、「消し終えた」とせずに止まる', async () => {
    database.sqlite.exec('DROP TABLE profiles')
    const auth = createFakeAuth([])
    const deps = createTestDeps({ runner: createFakeWrangler(database.sqlite).runner, env: { [NAME_SCRUB_CONFIRM_ENV]: 'yes' } })

    await expect(main(['--apply'], deps, auth)).rejects.toThrow('profiles の表が見つかりません')
    expect(deps.lines.join('\n')).not.toContain('すべて消しました')
  })

  it('Supabase の接続情報が無ければ、キー名だけを示して止まる', async () => {
    const deps = createTestDeps({ runner: createFakeWrangler(database.sqlite).runner, env: {} })

    const code = await main([], deps)

    expect(code).toBe(1)
    expect(deps.errors.join('\n')).toContain('NEXT_PUBLIC_SUPABASE_URL')
    expect(deps.errors.join('\n')).toContain('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('知らないオプションは打ち間違いとして止める', async () => {
    const deps = createTestDeps({ runner: createFakeWrangler(database.sqlite).runner })
    expect(await main(['--aply'], deps, createFakeAuth(allUsers))).toBe(1)
  })
})
