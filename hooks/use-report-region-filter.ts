"use client"

// ヒヤリハット報告の地域絞り込み(県 → 市町村 → 学校周辺)の状態管理フック
//
// ランディングの「みんなのヒヤリハット報告」と /report 一覧で共有する。
// - 都道府県・市町村: 報告フィルタ専用のキー(user-region.ts の REPORT_REGION_STORAGE_KEY)。
//   地域アラートの選択とは市町村の呼び名の体系が違うため混ぜない。
//   都道府県は従来どおり「あなたの地域」(Push購読・地図・ニュースの既定)にも反映する
// - 学校: セッション内のみ(検索結果の座標を保存し続けない)
// 学校を選ぶと県・市町村の eq 絞り込みは使わず、学校周辺の矩形+距離で絞る。

import * as React from "react"
import {
  NATIONWIDE,
  getReportRegionCity,
  getStoredReportRegion,
  setStoredRegion,
  setStoredReportRegion,
  type ReportRegionSelection,
} from "@/lib/user-region"
import {
  PREVIEW_COORD_SLACK_KM,
  SCHOOL_RADIUS_KM,
  buildMunicipalityOptions,
  isWithinSchoolRadius,
  latLngBoundsForRadius,
  type SchoolSelection,
} from "@/lib/region-filter"
import {
  describeRegionRequestError,
  fetchRegionJson,
  type RegionLoadStatus,
} from "@/lib/region-request"

interface RegionSourceClient {
  from: (table: string) => {
    select: (columns: string) => any
  }
}

export interface UseReportRegionFilterOptions {
  /** null の間は市町村選択肢の取得を行わない */
  client: RegionSourceClient | null
  /** 報告の取得元(danger_reports / danger_reports_public_preview) */
  table: string
  /** 公開扱いの status 一覧。モジュール定数など識別子が安定した配列を渡すこと */
  statuses: readonly string[]
  /**
   * 学校周辺判定に加える座標誤差の許容幅(km)。
   * 丸め済みプレビュー(danger_reports_public_preview)なら既定値、
   * 精密座標(danger_reports)なら 0 を渡して「周辺2km」表示と挙動を一致させる。
   */
  coordSlackKm?: number
}

/** 市町村の選択肢(選択中の県にある報告の city)の読み込み状態 */
export interface CityOptionsState {
  status: RegionLoadStatus
  /** status が "error" のときの理由(日本語) */
  errorMessage: string | null
  retry: () => void
}

export interface UseReportRegionFilterResult {
  mounted: boolean
  prefecture: string
  city: string | null
  school: SchoolSelection | null
  cityOptions: string[]
  cityOptionsState: CityOptionsState
  handlePrefectureChange: (prefecture: string) => void
  handleCityChange: (city: string | null) => void
  handleSchoolChange: (school: SchoolSelection | null) => void
  /** 絞り込み条件の複合キー。取得エフェクトの依存に使う */
  regionKey: string
  /** 空表示などに使う「東京都千代田区」「○○小学校の周辺2km」形式のラベル */
  scopeLabel: string
  /** PostgREST クエリへ eq / 矩形(gte/lte) の絞り込みを適用する */
  applyRegionFilter: <T>(query: T) => T
  /** 学校選択中のみ、矩形取得後の行を距離で絞り込む */
  refineBySchool: <R extends { latitude: number | null; longitude: number | null }>(
    rows: R[],
  ) => R[]
}

interface CityOptionsLoad {
  /** どの県の読み込み結果か。選択中の県と違えば使わない(前の県の選択肢を出さない) */
  prefecture: string
  status: "loading" | "ready" | "error"
  options: string[]
  errorMessage: string | null
}

const NO_CITY_OPTIONS: string[] = []

/** /api/reports の応答から city 列だけを取り出す(形が違えば空として扱う) */
function readReportCities(payload: unknown): Array<string | null> {
  const reports = typeof payload === "object" && payload !== null
    ? (payload as { reports?: unknown }).reports
    : undefined
  if (!Array.isArray(reports)) return []
  return reports.map((row) => {
    const value = typeof row === "object" && row !== null ? (row as { city?: unknown }).city : null
    return typeof value === "string" ? value : null
  })
}

export function useReportRegionFilter(
  options: UseReportRegionFilterOptions,
): UseReportRegionFilterResult {
  const { client, table, statuses, coordSlackKm = PREVIEW_COORD_SLACK_KM } = options
  const [mounted, setMounted] = React.useState(false)
  const [prefecture, setPrefecture] = React.useState<string>(NATIONWIDE)
  const [city, setCity] = React.useState<string | null>(null)
  const [lastCity, setLastCity] = React.useState<ReportRegionSelection["lastCity"]>(null)
  const [school, setSchool] = React.useState<SchoolSelection | null>(null)
  const [cityLoad, setCityLoad] = React.useState<CityOptionsLoad | null>(null)
  const [cityReloadCount, setCityReloadCount] = React.useState(0)
  const cityOptionsCacheRef = React.useRef(new Map<string, string[]>())

  // localStorage 復元は SSR とずれないよう effect 内で行う
  React.useEffect(() => {
    const stored = getStoredReportRegion()
    setPrefecture(stored.prefecture)
    setLastCity(stored.lastCity)
    setCity(getReportRegionCity(stored.lastCity, stored.prefecture))
    setMounted(true)
  }, [])

  // 状態を正とし、変わるたびに報告フィルタ専用のキーへ書き戻す(地域アラートのキーには触れない)
  React.useEffect(() => {
    if (mounted) setStoredReportRegion({ prefecture, lastCity })
  }, [mounted, prefecture, lastCity])

  const handlePrefectureChange = React.useCallback((nextPrefecture: string) => {
    setPrefecture(nextPrefecture)
    setStoredRegion(nextPrefecture)
    setCity(getReportRegionCity(lastCity, nextPrefecture))
    setSchool(null)
  }, [lastCity])

  const handleCityChange = React.useCallback(
    (nextCity: string | null) => {
      setCity(nextCity)
      setSchool(null)
      setLastCity(nextCity && prefecture !== NATIONWIDE ? { prefecture, city: nextCity } : null)
    },
    [prefecture],
  )

  const handleSchoolChange = React.useCallback((nextSchool: SchoolSelection | null) => {
    setSchool(nextSchool)
  }, [])

  const retryCityOptions = React.useCallback(() => {
    setCityReloadCount((count) => count + 1)
  }, [])

  // 市町村の選択肢: 選択中の県にある報告の city から動的生成(県ごとにキャッシュ)。
  // 取得は時間切れ付きで、県の切り替え・アンマウントで中止する
  React.useEffect(() => {
    if (!mounted || prefecture === NATIONWIDE) return
    const cached = cityOptionsCacheRef.current.get(prefecture)
    if (cached) {
      setCityLoad({ prefecture, status: "ready", options: cached, errorMessage: null })
      return
    }

    const controller = new AbortController()
    setCityLoad({ prefecture, status: "loading", options: NO_CITY_OPTIONS, errorMessage: null })
    const params = new URLSearchParams({ prefecture, limit: "2000" })
    statuses.forEach((status) => params.append("status", status))
    fetchRegionJson(`/api/reports?${params}`, { signal: controller.signal })
      .then((payload) => {
        const nextOptions = buildMunicipalityOptions(readReportCities(payload))
        cityOptionsCacheRef.current.set(prefecture, nextOptions)
        if (controller.signal.aborted) return
        setCityLoad({ prefecture, status: "ready", options: nextOptions, errorMessage: null })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error("市町村選択肢の取得に失敗しました", error)
        setCityLoad({
          prefecture,
          status: "error",
          options: NO_CITY_OPTIONS,
          errorMessage: describeRegionRequestError(error),
        })
      })
    return () => {
      controller.abort()
    }
  }, [mounted, statuses, prefecture, cityReloadCount])

  // 県を切り替えた直後(読み込み結果がまだ前の県のもの)は「読み込み中」として扱い、
  // 前の県の市町村を選べないようにする
  const currentCityLoad = mounted && prefecture !== NATIONWIDE
    ? cityLoad?.prefecture === prefecture
      ? cityLoad
      : { prefecture, status: "loading" as const, options: NO_CITY_OPTIONS, errorMessage: null }
    : null
  const cityOptions = currentCityLoad?.options ?? NO_CITY_OPTIONS
  const cityOptionsStatus: RegionLoadStatus = currentCityLoad?.status ?? "idle"
  const cityOptionsError = currentCityLoad?.errorMessage ?? null
  const cityOptionsState = React.useMemo<CityOptionsState>(
    () => ({ status: cityOptionsStatus, errorMessage: cityOptionsError, retry: retryCityOptions }),
    [cityOptionsStatus, cityOptionsError, retryCityOptions],
  )

  const regionKey = `${prefecture}|${city ?? ""}|${school?.id ?? ""}`

  const scopeLabel = React.useMemo(() => {
    if (school) return `${school.name}の周辺${SCHOOL_RADIUS_KM}km`
    if (prefecture === NATIONWIDE) return NATIONWIDE
    return city ? `${prefecture}${city}` : prefecture
  }, [prefecture, city, school])

  const applyRegionFilter = React.useCallback(
    <T,>(query: T): T => {
      let filtered: any = query
      if (school) {
        const bounds = latLngBoundsForRadius(
          school.latitude,
          school.longitude,
          SCHOOL_RADIUS_KM + coordSlackKm,
        )
        filtered = filtered
          .gte("latitude", bounds.minLat)
          .lte("latitude", bounds.maxLat)
          .gte("longitude", bounds.minLng)
          .lte("longitude", bounds.maxLng)
      } else if (prefecture !== NATIONWIDE) {
        filtered = filtered.eq("prefecture", prefecture)
        if (city) {
          filtered = filtered.eq("city", city)
        }
      }
      return filtered as T
    },
    [prefecture, city, school, coordSlackKm],
  )

  const refineBySchool = React.useCallback(
    <R extends { latitude: number | null; longitude: number | null }>(rows: R[]): R[] => {
      if (!school) return rows
      return rows.filter((row) =>
        isWithinSchoolRadius(row, school, SCHOOL_RADIUS_KM, coordSlackKm),
      )
    },
    [school, coordSlackKm],
  )

  return {
    mounted,
    prefecture,
    city,
    school,
    cityOptions,
    cityOptionsState,
    handlePrefectureChange,
    handleCityChange,
    handleSchoolChange,
    regionKey,
    scopeLabel,
    applyRegionFilter,
    refineBySchool,
  }
}
