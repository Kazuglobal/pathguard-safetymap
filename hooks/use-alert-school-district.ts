"use client"

// 今日の地域アラートの地域選択(都道府県 → 市区町村 → 小学校区)
//
// - 市区町村は「県」を、小学校区は「県+市区町村」をキーに別々に取得する。
//   1本のキーにまとめると、市区町村を選んだ瞬間に市区町村の一覧まで空になり、
//   選んだ値が「市区町村を選択」へ戻ってしまう。
// - 取得は時間切れ付き(lib/region-request.ts)。失敗は select ごとに理由を返す。
// - 選択は地域アラート専用のキーへ保存する(lib/user-region.ts)。報告一覧の地域フィルタとは
//   市町村の呼び名の体系が違うため共有しない。都道府県だけは「あなたの地域」
//   (Push購読の配信地域・地図・ニュースの既定)にも反映する。

import { useCallback, useEffect, useState } from 'react'
import useSWR, { type SWRConfiguration } from 'swr'
import {
  ALL_PREFECTURES,
  EMPTY_ALERTS_REGION,
  NATIONWIDE,
  getStoredAlertsRegion,
  setStoredAlertsRegion,
  setStoredRegion,
  type AlertsRegionSelection,
} from '@/lib/user-region'
import { syncPushSubscriptionRegion } from '@/hooks/use-push-subscription'
import type { SchoolDistrictOption, SchoolDistrictOptions } from '@/lib/school-districts'
import {
  RegionRequestError,
  describeRegionRequestError,
  fetchRegionJson,
  type RegionLoadStatus,
} from '@/lib/region-request'

const NO_CITIES: string[] = []
const NO_DISTRICTS: SchoolDistrictOption[] = []

// 学区マスターは静的なデータ。失敗時の自動再試行やフォーカス復帰の再取得で
// select を「読み込み中…」へ戻さないよう、再取得は「もう一度読み込む」に任せる
const MASTER_SWR_OPTIONS: SWRConfiguration<SchoolDistrictOptions> = {
  keepPreviousData: false,
  shouldRetryOnError: false,
  revalidateOnFocus: false,
}

export function schoolDistrictOptionsUrl(prefecture: string, city?: string | null): string {
  const params = new URLSearchParams({ prefecture })
  if (city) params.set('city', city)
  return `/api/school-districts?${params}`
}

function isSchoolDistrictOption(value: unknown): value is SchoolDistrictOption {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return ['id', 'municipalityCode', 'schoolCode', 'prefecture', 'city', 'name', 'sourceUrl']
    .every(field => typeof item[field] === 'string') && typeof item.dataYear === 'number'
}

export function parseSchoolDistrictOptions(payload: unknown): SchoolDistrictOptions {
  const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : null
  if (!record || !Array.isArray(record.cities) || !Array.isArray(record.districts)) {
    throw new RegionRequestError('invalid')
  }
  return {
    cities: record.cities.filter((city): city is string => typeof city === 'string' && city.trim() !== ''),
    districts: record.districts.filter(isSchoolDistrictOption),
  }
}

export async function fetchSchoolDistrictOptions(url: string): Promise<SchoolDistrictOptions> {
  return parseSchoolDistrictOptions(await fetchRegionJson(url))
}

interface MasterQuery {
  data?: unknown
  error?: unknown
  isLoading: boolean
}

function loadStatusOf(key: string | null, query: MasterQuery): RegionLoadStatus {
  if (!key) return 'idle'
  if (query.data !== undefined) return 'ready'
  // 「もう一度読み込む」の最中は error が残ったまま isLoading になる
  if (query.error !== undefined && !query.isLoading) return 'error'
  return 'loading'
}

export function useAlertSchoolDistrict() {
  const [mounted, setMounted] = useState(false)
  const [selection, setSelection] = useState<AlertsRegionSelection>(EMPTY_ALERTS_REGION)

  // localStorage の復元は SSR とずれないよう effect 内で行う
  useEffect(() => {
    setSelection(getStoredAlertsRegion())
    setMounted(true)
  }, [])

  // 状態を正とし、変わるたびに専用キーへ書き戻す(他の機能のキーには触れない)
  useEffect(() => {
    if (mounted) setStoredAlertsRegion(selection)
  }, [mounted, selection])

  const { prefecture, city, schoolDistrictId } = selection
  const citiesKey = mounted && prefecture ? schoolDistrictOptionsUrl(prefecture) : null
  const districtsKey = mounted && prefecture && city ? schoolDistrictOptionsUrl(prefecture, city) : null
  const citiesQuery = useSWR<SchoolDistrictOptions>(citiesKey, fetchSchoolDistrictOptions, MASTER_SWR_OPTIONS)
  const districtsQuery = useSWR<SchoolDistrictOptions>(districtsKey, fetchSchoolDistrictOptions, MASTER_SWR_OPTIONS)
  const citiesStatus = loadStatusOf(citiesKey, citiesQuery)
  const districtsStatus = loadStatusOf(districtsKey, districtsQuery)
  const cities = citiesStatus === 'ready' ? citiesQuery.data?.cities ?? NO_CITIES : NO_CITIES
  const districts = districtsStatus === 'ready' ? districtsQuery.data?.districts ?? NO_DISTRICTS : NO_DISTRICTS

  // 保存済みの値は、マスターで存在を確かめられたときだけ使い続ける
  useEffect(() => {
    if (citiesStatus !== 'ready' || !city || cities.includes(city)) return
    setSelection(current => (current.prefecture === prefecture && current.city === city
      ? { ...current, city: null, schoolDistrictId: null }
      : current))
  }, [citiesStatus, cities, prefecture, city])

  useEffect(() => {
    if (districtsStatus !== 'ready' || !schoolDistrictId || districts.some(item => item.id === schoolDistrictId)) return
    setSelection(current => (current.city === city && current.schoolDistrictId === schoolDistrictId
      ? { ...current, schoolDistrictId: null }
      : current))
  }, [districtsStatus, districts, city, schoolDistrictId])

  const district = districts.find(item => (
    item.id === schoolDistrictId && item.prefecture === prefecture && item.city === city
  )) ?? null
  // 復元した市区町村がマスターで確かめられる前に「未対応」と言わない
  const cityConfirmed = citiesStatus === 'ready' && city !== null && cities.includes(city)
  const unsupported = (citiesStatus === 'ready' && cities.length === 0)
    || (cityConfirmed && districtsStatus === 'ready' && districts.length === 0)

  const changePrefecture = useCallback((nextPrefecture: string) => {
    const next = (ALL_PREFECTURES as readonly string[]).includes(nextPrefecture) ? nextPrefecture : ''
    setSelection({ prefecture: next, city: null, schoolDistrictId: null })
    setStoredRegion(next || NATIONWIDE)
    void syncPushSubscriptionRegion(next || NATIONWIDE)
  }, [])

  const changeCity = useCallback((nextCity: string) => {
    setSelection(current => ({ ...current, city: nextCity || null, schoolDistrictId: null }))
  }, [])

  const changeDistrict = useCallback((id: string) => {
    setSelection(current => ({ ...current, schoolDistrictId: id || null }))
  }, [])

  const { mutate: mutateCities } = citiesQuery
  const { mutate: mutateDistricts } = districtsQuery
  const retryCities = useCallback(() => { void mutateCities() }, [mutateCities])
  const retryDistricts = useCallback(() => { void mutateDistricts() }, [mutateDistricts])

  return {
    mounted,
    prefecture,
    city,
    districtId: district?.id ?? '',
    district,
    cities,
    districts,
    citiesStatus,
    districtsStatus,
    citiesError: citiesStatus === 'error' ? describeRegionRequestError(citiesQuery.error) : null,
    districtsError: districtsStatus === 'error' ? describeRegionRequestError(districtsQuery.error) : null,
    unsupported,
    retryCities,
    retryDistricts,
    changePrefecture,
    changeCity,
    changeDistrict,
  }
}
