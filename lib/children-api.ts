import { CHILD_NICKNAME_MAX_LENGTH, MAX_CHILDREN_PER_USER } from '@/lib/children-limits'
import type { ChildRow, ChildWithDistrict, ChildWriteInput } from '@/lib/db/repos/children.repo'

/** 子どもの登録の API 入出力(UIUX改装 項目56)。本人にだけ返す */

function optionalNullableString(body: Record<string, unknown>, key: string): string | null | undefined {
  const value = body[key]
  if (typeof value === 'string') return value.trim() === '' ? null : value
  if (value === null) return null
  return undefined
}

function optionalGrade(body: Record<string, unknown>): number | null | undefined {
  const value = body.grade
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const grade = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(grade)) throw new RangeError('Invalid child grade')
  return grade
}

export function parseChildWriteInput(value: unknown): ChildWriteInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RangeError('Invalid child body')
  const body = value as Record<string, unknown>
  if (body.nickname !== undefined && typeof body.nickname !== 'string') throw new RangeError('Invalid child nickname')
  return {
    nickname: typeof body.nickname === 'string' ? body.nickname : undefined,
    grade: optionalGrade(body),
    schoolDistrictId: optionalNullableString(body, 'school_district_id'),
    confirmNickname: body.confirm_nickname === true ? true : undefined,
  }
}

export function toChildJson(child: ChildRow | ChildWithDistrict) {
  const district = 'schoolDistrictName' in child && child.schoolDistrictName
    ? { name: child.schoolDistrictName, city: child.schoolDistrictCity, prefecture: child.schoolDistrictPrefecture }
    : null
  return {
    id: child.id,
    nickname: child.nickname,
    grade: child.grade,
    school_district_id: child.schoolDistrictId,
    school_district: district,
    /** false のあいだは「呼び名が本名になっていないか」を一度だけ確かめてもらう */
    nickname_confirmed: child.nicknameConfirmedAt !== null,
  }
}

export type ChildJson = ReturnType<typeof toChildJson>

/** 入力の誤りを、画面に出せる日本語にする(英語の内部メッセージは出さない) */
export function childErrorMessage(error: RangeError): string {
  switch (error.message) {
    case 'Invalid child nickname': return `呼び名は1〜${CHILD_NICKNAME_MAX_LENGTH}文字で入力してください`
    case 'Child nickname already exists': return '同じ呼び名がすでに登録されています'
    case 'Too many children': return `登録できるのは${MAX_CHILDREN_PER_USER}人までです`
    case 'Invalid child grade': return '学年は1〜6年生から選んでください'
    case 'Unknown school district': return '学区が見つかりませんでした。選び直してください'
    default: return '入力を確かめてください'
  }
}
