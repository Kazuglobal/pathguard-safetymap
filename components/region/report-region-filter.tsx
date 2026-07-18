"use client"

// ヒヤリハット報告の地域フィルタUI(県チップ+全県プルダウン / 市町村 / 学校検索)
//
// 状態は持たず、use-report-region-filter フックの値とハンドラを受け取って描画する。
// variant="tanken" はランディング(たんけんノート配色)、"plain" は /report 一覧向け。

import * as React from "react"
import { School as SchoolIcon, Search, Loader2, X } from "lucide-react"
import {
  ALL_PREFECTURES,
  NATIONWIDE,
  getRegionChipOptions,
} from "@/lib/user-region"
import { SCHOOL_RADIUS_KM, type SchoolSelection } from "@/lib/region-filter"
import { searchSchools, type SchoolSearchResult } from "@/lib/school-search"
import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

export interface ReportRegionFilterProps {
  prefecture: string
  city: string | null
  school: SchoolSelection | null
  cityOptions: string[]
  onPrefectureChange: (prefecture: string) => void
  onCityChange: (city: string | null) => void
  onSchoolChange: (school: SchoolSelection | null) => void
  variant?: "tanken" | "plain"
}

export function ReportRegionFilter({
  prefecture,
  city,
  school,
  cityOptions,
  onPrefectureChange,
  onCityChange,
  onSchoolChange,
  variant = "plain",
}: ReportRegionFilterProps) {
  const isTanken = variant === "tanken"
  // 復元した市町村が選択肢に無い場合(該当報告が消えた等)でも、表示と
  // フィルタ状態がズレないよう選択中の値は選択肢へ補完する
  const cityChoices = React.useMemo(() => {
    if (city && !cityOptions.includes(city)) return [...cityOptions, city]
    return cityOptions
  }, [city, cityOptions])
  const [schoolQuery, setSchoolQuery] = React.useState("")
  const [schoolResults, setSchoolResults] = React.useState<SchoolSearchResult[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [searchMessage, setSearchMessage] = React.useState<string | null>(null)

  const focusCls = isTanken
    ? tankenTokens.cls.focus
    : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
  const labelStyle = isTanken ? { color: C.inkSoft } : undefined
  const labelCls = isTanken ? "text-xs font-bold" : "text-xs font-bold text-slate-500"
  const selectCls = `rounded-full border px-3 py-1 text-xs font-bold ${focusCls} ${
    isTanken ? "" : "border-slate-200 bg-white text-slate-600"
  }`.trim()
  const selectStyle = isTanken
    ? { background: C.card, color: C.inkSoft, borderColor: tankenTokens.border.soft }
    : undefined

  const handleSchoolSearch = async (event: React.FormEvent) => {
    event.preventDefault()
    const query = schoolQuery.trim()
    if (!query || isSearching) return
    setIsSearching(true)
    setSearchMessage(null)
    try {
      const results = await searchSchools(query)
      setSchoolResults(results)
      if (results.length === 0) {
        setSearchMessage("学校が見つかりませんでした。名称を変えてお試しください。")
      }
    } catch (error) {
      console.error("学校検索に失敗しました", error)
      setSchoolResults([])
      setSearchMessage("学校検索を利用できませんでした。時間をおいてお試しください。")
    } finally {
      setIsSearching(false)
    }
  }

  const handleSchoolSelect = (result: SchoolSearchResult) => {
    onSchoolChange({
      id: result.id,
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
    })
    setSchoolResults([])
    setSearchMessage(null)
    setSchoolQuery("")
  }

  return (
    <div className="space-y-2">
      {/* 都道府県: クイックチップ + 全47件プルダウン */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
        <span className={`flex-shrink-0 ${labelCls}`} style={labelStyle}>
          地域:
        </span>
        {getRegionChipOptions(prefecture).map((pref) => {
          const active = prefecture === pref
          return (
            <button
              key={pref}
              type="button"
              onClick={() => onPrefectureChange(pref)}
              aria-pressed={active}
              className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition-colors ${focusCls} ${
                isTanken
                  ? ""
                  : active
                    ? "border-sky-600 bg-sky-600 text-white"
                    : "border-slate-200 bg-white text-slate-600"
              }`.trim()}
              style={
                isTanken
                  ? active
                    ? { background: C.accent, color: "#fff", borderColor: C.accent }
                    : { background: C.card, color: C.inkSoft, borderColor: tankenTokens.border.soft }
                  : undefined
              }
            >
              {pref}
            </button>
          )
        })}
        <select
          aria-label="都道府県を選ぶ"
          value={prefecture}
          onChange={(event) => onPrefectureChange(event.target.value)}
          className={`flex-shrink-0 ${selectCls}`}
          style={selectStyle}
        >
          <option value={NATIONWIDE}>{NATIONWIDE}</option>
          {ALL_PREFECTURES.map((pref) => (
            <option key={pref} value={pref}>
              {pref}
            </option>
          ))}
        </select>
      </div>

      {/* 市町村: 選択中の県に報告がある市町村のみ */}
      {prefecture !== NATIONWIDE && cityChoices.length > 0 && (
        <div className="flex items-center gap-2">
          <span className={`flex-shrink-0 ${labelCls}`} style={labelStyle}>
            市町村:
          </span>
          <select
            aria-label="市町村を選ぶ"
            value={city ?? ""}
            onChange={(event) => onCityChange(event.target.value || null)}
            className={selectCls}
            style={selectStyle}
          >
            <option value="">すべて</option>
            {cityChoices.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 学校: 選択中はチップ表示、未選択は検索フォーム */}
      {school ? (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
              isTanken ? "" : "border-sky-200 bg-sky-50 text-sky-700"
            }`.trim()}
            style={
              isTanken
                ? { background: C.accentSoft, color: C.accentStrong, borderColor: tankenTokens.border.soft }
                : undefined
            }
          >
            <SchoolIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {school.name}
            <button
              type="button"
              onClick={() => onSchoolChange(null)}
              aria-label="学校の絞り込みを解除"
              className={`rounded-full ${focusCls}`}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
          <span className={labelCls} style={labelStyle}>
            周辺{SCHOOL_RADIUS_KM}kmの報告を表示中
          </span>
        </div>
      ) : (
        <div className="space-y-1">
          <form onSubmit={handleSchoolSearch} className="flex items-center gap-2">
            <input
              type="text"
              aria-label="学校名で探す"
              placeholder="学校名で探す(例: ○○小学校)"
              value={schoolQuery}
              onChange={(event) => setSchoolQuery(event.target.value)}
              className={`w-full max-w-xs rounded-full border px-3 py-1 text-xs ${focusCls} ${
                isTanken ? "" : "border-slate-200 bg-white text-slate-700"
              }`.trim()}
              style={selectStyle}
            />
            <button
              type="submit"
              disabled={isSearching}
              aria-label="学校を検索"
              className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${focusCls} ${
                isTanken ? "" : "border-slate-200 bg-white text-slate-600"
              }`.trim()}
              style={selectStyle}
            >
              {isSearching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </form>
          {schoolResults.length > 0 && (
            <ul
              className={`max-w-md divide-y rounded-2xl border text-left ${
                isTanken ? "" : "divide-slate-100 border-slate-200 bg-white"
              }`.trim()}
              style={
                isTanken
                  ? { background: C.card, borderColor: tankenTokens.border.soft }
                  : undefined
              }
            >
              {schoolResults.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => handleSchoolSelect(result)}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left ${focusCls}`}
                  >
                    <SchoolIcon
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600"
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className={`block text-xs font-bold ${isTanken ? "" : "text-slate-700"}`} style={labelStyle}>
                        {result.name}
                      </span>
                      {result.address && (
                        <span className={`block truncate text-[11px] ${isTanken ? "" : "text-slate-400"}`}>
                          {result.address}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searchMessage && (
            <p className={`text-xs ${isTanken ? "" : "text-slate-500"}`} style={labelStyle} role="status">
              {searchMessage}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
