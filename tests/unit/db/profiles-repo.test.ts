// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import { createProfilesRepo } from '@/lib/db/repos/profiles.repo'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'
import { toProfileJson } from '@/lib/profile-api'

const USER_ID = '00000000-0000-4000-8000-0000000000aa'
const actor: Actor = { kind: 'user', id: USER_ID, email: 'parent@example.com', isAdmin: false }

let database: TestDatabase

beforeEach(() => {
  database = createTestDatabase()
})

afterEach(() => {
  database.sqlite.close()
})

function storedFullName(): unknown {
  return (database.sqlite.prepare('select full_name from profiles where id = ?').get(USER_ID) as { full_name: unknown } | undefined)?.full_name
}

describe('プロフィールは氏名を預からない(UIUX改装 項目55)', () => {
  it('表示名を保存すると、以前に預かった氏名が残っていても消える', async () => {
    database.sqlite.prepare('insert into profiles (id, email, display_name, full_name) values (?, ?, ?, ?)')
      .run(USER_ID, 'parent@example.com', '前の表示名', '山田 花子')

    const row = await createProfilesRepo(database.db).upsertOwn(actor, 'parent@example.com', { displayName: 'さくらママ' })

    expect(row.displayName).toBe('さくらママ')
    expect(storedFullName()).toBeNull()
  })

  it('アイコンだけを保存しても氏名は消え、表示名はそのまま', async () => {
    database.sqlite.prepare('insert into profiles (id, email, display_name, full_name) values (?, ?, ?, ?)')
      .run(USER_ID, 'parent@example.com', 'さくらママ', '山田 花子')

    const row = await createProfilesRepo(database.db).upsertOwn(actor, 'parent@example.com', { avatarKey: `avatars/${USER_ID}/icon.webp` })

    expect(row.displayName).toBe('さくらママ')
    expect(row.avatarKey).toBe(`avatars/${USER_ID}/icon.webp`)
    expect(storedFullName()).toBeNull()
  })

  it('新しく作る行には氏名を入れない', async () => {
    await createProfilesRepo(database.db).upsertOwn(actor, 'parent@example.com', { displayName: 'さくらママ' })
    expect(storedFullName()).toBeNull()
  })

  it('API に返す JSON に氏名の項目を含めない', async () => {
    const row = await createProfilesRepo(database.db).upsertOwn(actor, 'parent@example.com', { displayName: 'さくらママ' })
    const json = toProfileJson({ ...row, fullName: '山田 花子' })

    expect(json).not.toHaveProperty('full_name')
    expect(JSON.stringify(json)).not.toContain('山田')
    expect(json.display_name).toBe('さくらママ')
  })
})
