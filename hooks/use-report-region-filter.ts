"use client"

// ヒヤリハット報告の地域絞り込み(県 → 市町村 → 学校周辺)の状態管理フック
//
// ランディングの「みんなのヒヤリハット報告」と /report 一覧で共有する。
// - 都道府県: 既存の共有 localStorage(user-region.ts)を読み書き
// - 市町村: 県とペアの別キーに保存(他セクション・Push購読へ影響させない)
// - 学校: セッション内のみ(検索結果の座標を保存し続けない)
// 学校を選ぶと県・市町村の eq 絞り込みは使わず、学校周辺の矩形+距離で絞る。

import * as React from "react"
import {
  NATIONWIDE,
  getStoredCity,
  getStoredRegion,
  setStoredCity,
  setStoredRegion,
} from "@/lib/user-region"
import {
  PREVIEW_COORD_SLACK_KM,
  SCHOOL_RADIUS_KM,
  buildMunicipalityOptions,
  isWithinSchoolRadius,
  latLngBoundsForRadius,
  type SchoolSelection,
} from "@/lib/region-filter"

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

export interface UseReportRegionFilterResult {
  mounted: boolean
  prefecture: string
  city: string | null
  school: SchoolSelection | null
  cityOptions: string[]
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

export function useReportRegionFilter(
  options: UseReportRegionFilterOptions,
): UseReportRegionFilterResult {
  const { client, table, statuses, coordSlackKm = PREVIEW_COORD_SLACK_KM } = options
  const [mounted, setMounted] = React.useState(false)
  const [prefecture, setPrefecture] = React.useState<string>(NATIONWIDE)
  const [city, setCity] = React.useState<string | null>(null)
  const [school, setSchool] = React.useState<SchoolSelection | null>(null)
  const [cityOptions, setCityOptions] = React.useState<string[]>([])
  const cityOptionsCacheRef = React.useRef(new Map<string, string[]>())

  // localStorage 復元は SSR とずれないよう effect 内で行う
  React.useEffect(() => {
    const storedPrefecture = getStoredRegion()
    setPrefecture(storedPrefecture)
    setCity(storedPrefecture === NATIONWIDE ? null : getStoredCity(storedPrefecture))
    setMounted(true)
  }, [])

  const handlePrefectureChange = React.useCallback((nextPrefecture: string) => {
    setPrefecture(nextPrefecture)
    setStoredRegion(nextPrefecture)
    setCity(nextPrefecture === NATIONWIDE ? null : getStoredCity(nextPrefecture))
    setSchool(null)
  }, [])

  const handleCityChange = React.useCallback(
    (nextCity: string | null) => {
      setCity(nextCity)
      setSchool(null)
      setStoredCity(prefecture, nextCity)
    },
    [prefecture],
  )

  const handleSchoolChange = React.useCallback((nextSchool: SchoolSelection | null) => {
    setSchool(nextSchool)
  }, [])

  // 市町村の選択肢: 選択中の県にある報告の city から動的生成(県ごとにキャッシュ)
  React.useEffect(() => {
    if (!mounted || !client || prefecture === NATIONWIDE) {
      setCityOptions([])
      return
    }
    const cached = cityOptionsCacheRef.current.get(prefecture)
    // キャッシュミス時も先に空へ落とす。前の県の選択肢が fetch 解決まで
    // 残ると、別の県+他県の市町村という成立しない絞り込みを選べてしまう
    setCityOptions(cached ?? [])
    if (cached) {
      return
    }

    let ignore = false
    async function fetchCityOptions() {
      try {
        const { data, error } = await client!
          .from(table)
          .select("city")
          .in("status", [...statuses])
          .eq("prefecture", prefecture)
          .not("city", "is", null)
          .limit(1000)
        if (error) throw error
        if (ignore) return
        const nextOptions = buildMunicipalityOptions(
          ((data ?? []) as Array<{ city: string | null }>).map((row) => row.city),
        )
        cityOptionsCacheRef.current.set(prefecture, nextOptions)
        setCityOptions(nextOptions)
      } catch (error) {
        console.error("市町村選択肢の取得に失敗しました", error)
        if (!ignore) setCityOptions([])
      }
    }
    fetchCityOptions()
    return () => {
      ignore = true
    }
  }, [mounted, client, table, statuses, prefecture])

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
    handlePrefectureChange,
    handleCityChange,
    handleSchoolChange,
    regionKey,
    scopeLabel,
    applyRegionFilter,
    refineBySchool,
  }
}
