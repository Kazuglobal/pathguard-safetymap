"use client"

import type { SchoolDistrictPicker as Picker } from "@/hooks/use-school-district-picker"
import { tankenTokens } from "@/lib/design/tanken"
import type { RegionLoadStatus } from "@/lib/region-request"
import { ALL_PREFECTURES } from "@/lib/user-region"

const t = tankenTokens

const selectClass = `min-h-11 w-full rounded-xl border bg-white px-3 text-sm ${t.cls.focus}`

function placeholderFor(status: RegionLoadStatus, idleLabel: string): string {
  if (status === "loading") return "読み込み中…"
  if (status === "error") return "読み込めませんでした"
  return idleLabel
}

function LoadError({ subject, reason, onRetry }: { subject: string; reason: string; onRetry: () => void }) {
  return (
    <div role="alert" className="mt-2 rounded-xl border p-3" style={{ borderColor: "rgba(217,85,85,.4)" }}>
      <p className="text-sm font-bold text-red-700">{subject}を読み込めませんでした。</p>
      <p className="mt-1 text-xs" style={{ color: t.color.inkSoft }}>{reason}</p>
      <button
        type="button"
        onClick={onRetry}
        className={`mt-2 inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold ${t.cls.focus}`}
        style={{ borderColor: t.border.soft, color: t.color.primaryStrong }}
      >
        もう一度読み込む
      </button>
    </div>
  )
}

/** 都道府県 → 市区町村 → 小学校区。値は親が持つ(useSchoolDistrictPicker) */
export function SchoolDistrictPicker({ picker, idPrefix }: { picker: Picker; idPrefix: string }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-bold">小学校区(任意)</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs font-bold" style={{ color: t.color.inkSoft }} htmlFor={`${idPrefix}-prefecture`}>
          都道府県
          <select
            id={`${idPrefix}-prefecture`}
            className={`${selectClass} mt-1`}
            value={picker.prefecture}
            onChange={(event) => picker.changePrefecture(event.target.value)}
          >
            <option value="">都道府県を選択</option>
            {ALL_PREFECTURES.map((prefecture) => <option key={prefecture} value={prefecture}>{prefecture}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold" style={{ color: t.color.inkSoft }} htmlFor={`${idPrefix}-city`}>
          市区町村
          <select
            id={`${idPrefix}-city`}
            className={`${selectClass} mt-1`}
            value={picker.city ?? ""}
            disabled={picker.citiesStatus !== "ready" || picker.cities.length === 0}
            aria-busy={picker.citiesStatus === "loading" || undefined}
            onChange={(event) => picker.changeCity(event.target.value)}
          >
            <option value="">{placeholderFor(picker.citiesStatus, "市区町村を選択")}</option>
            {picker.cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold" style={{ color: t.color.inkSoft }} htmlFor={`${idPrefix}-district`}>
          小学校区
          <select
            id={`${idPrefix}-district`}
            className={`${selectClass} mt-1`}
            value={picker.schoolDistrictId ?? ""}
            disabled={picker.districtsStatus !== "ready" || picker.districts.length === 0}
            aria-busy={picker.districtsStatus === "loading" || undefined}
            onChange={(event) => picker.changeDistrict(event.target.value)}
          >
            <option value="">{placeholderFor(picker.districtsStatus, "小学校区を選択")}</option>
            {picker.districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
          </select>
        </label>
      </div>
      {picker.citiesStatus === "ready" && picker.cities.length === 0 && (
        <p className="text-xs" style={{ color: t.color.inkSoft }}>この都道府県の学区データはまだありません。</p>
      )}
      {picker.citiesError && <LoadError subject="市区町村の一覧" reason={picker.citiesError} onRetry={picker.retryCities} />}
      {picker.districtsError && <LoadError subject="小学校区の一覧" reason={picker.districtsError} onRetry={picker.retryDistricts} />}
    </fieldset>
  )
}
