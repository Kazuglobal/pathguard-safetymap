// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { childErrorMessage, parseChildWriteInput, toChildJson } from '@/lib/children-api'

describe('children API の入出力', () => {
  it('snake_case の本文をリポジトリの入力にする(空の学区は未設定、学年は数に)', () => {
    expect(parseChildWriteInput({ nickname: 'さくちゃん', grade: '3', school_district_id: '' })).toEqual({
      nickname: 'さくちゃん', grade: 3, schoolDistrictId: null, confirmNickname: undefined,
    })
    expect(parseChildWriteInput({ confirm_nickname: true })).toMatchObject({ confirmNickname: true, nickname: undefined, grade: undefined })
    expect(parseChildWriteInput({ grade: null })).toMatchObject({ grade: null })
  })

  it.each([null, [], 'child', { nickname: 3 }, { grade: 'three' }])('おかしな本文 %j は RangeError', (body) => {
    expect(() => parseChildWriteInput(body)).toThrow(RangeError)
  })

  it('本人に返す JSON は呼び名・学年・学区と確認済みかだけ(user_id は返さない)', () => {
    const json = toChildJson({
      id: 'c1', userId: 'user-1', nickname: 'さくちゃん', grade: 3, schoolDistrictId: 'd1', nicknameConfirmedAt: null,
      createdAt: '2026-10-29T00:00:00.000Z', updatedAt: '2026-10-29T00:00:00.000Z',
      schoolDistrictName: '第一小学校区', schoolDistrictCity: '新宿区', schoolDistrictPrefecture: '東京都',
    })

    expect(json).toEqual({
      id: 'c1', nickname: 'さくちゃん', grade: 3, school_district_id: 'd1',
      school_district: { name: '第一小学校区', city: '新宿区', prefecture: '東京都' },
      nickname_confirmed: false,
    })
    expect(json).not.toHaveProperty('user_id')
  })

  it('入力の誤りは画面に出せる日本語にする(知らないものは汎用の文)', () => {
    expect(childErrorMessage(new RangeError('Too many children'))).toBe('登録できるのは10人までです')
    expect(childErrorMessage(new RangeError('something internal'))).toBe('入力を確かめてください')
  })
})
