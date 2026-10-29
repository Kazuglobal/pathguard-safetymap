"use client"

// お子さまの学区を選ぶための、画面の中だけの学区選択(都道府県 → 市区町村 → 小学校区)。
// 地域アラートの選択(use-alert-school-district)と違い、localStorage にも通知の配信地域にも触れない。

import { useCallback, useState } from 'react'
import useSWR from 'swr'

import {
  MASTER_SWR_OPTIONS,
  fetchSchoolDistrictOptions,
  loadStatusOf,
  schoolDistrictOptionsUrl,
} from '@/hooks/use-alert-school-district'
import { describeRegionRequestError } from '@/lib/region-request'
import type { SchoolDistrictOption, SchoolDistrictOptions } from '@/lib/school-districts'
import { ALL_PREFECTURES } from '@/lib/user-region'

const NO_CITIES: string[] = []
const NO_DISTRICTS: SchoolDistrictOption[] = []

export interface SchoolDistrictPickerInitial {
  prefecture?: string | null
  city?: string | null
  schoolDistrictId?: string | null
}

export function useSchoolDistrictPicker(initial: SchoolDistrictPickerInitial = {}) {
  const [prefecture, setPrefecture] = useState(initial.prefecture ?? '')
  const [city, setCity] = useState<string | null>(initial.city ?? null)
  const [schoolDistrictId, setSchoolDistrictId] = useState<string | null>(initial.schoolDistrictId ?? null)

  const citiesKey = prefecture ? schoolDistrictOptionsUrl(prefecture) : null
  const districtsKey = prefecture && city ? schoolDistrictOptionsUrl(prefecture, city) : null
  const citiesQuery = useSWR<SchoolDistrictOptions>(citiesKey, fetchSchoolDistrictOptions, MASTER_SWR_OPTIONS)
  const districtsQuery = useSWR<SchoolDistrictOptions>(districtsKey, fetchSchoolDistrictOptions, MASTER_SWR_OPTIONS)
  const citiesStatus = loadStatusOf(citiesKey, citiesQuery)
  const districtsStatus = loadStatusOf(districtsKey, districtsQuery)
  const cities = citiesStatus === 'ready' ? citiesQuery.data?.cities ?? NO_CITIES : NO_CITIES
  const districts = districtsStatus === 'ready' ? districtsQuery.data?.districts ?? NO_DISTRICTS : NO_DISTRICTS

  const changePrefecture = useCallback((next: string) => {
    setPrefecture((ALL_PREFECTURES as readonly string[]).includes(next) ? next : '')
    setCity(null)
    setSchoolDistrictId(null)
  }, [])

  const changeCity = useCallback((next: string) => {
    setCity(next || null)
    setSchoolDistrictId(null)
  }, [])

  const changeDistrict = useCallback((next: string) => {
    setSchoolDistrictId(next || null)
  }, [])

  const { mutate: mutateCities } = citiesQuery
  const { mutate: mutateDistricts } = districtsQuery
  const retryCities = useCallback(() => { void mutateCities() }, [mutateCities])
  const retryDistricts = useCallback(() => { void mutateDistricts() }, [mutateDistricts])

  // 一覧で確かめられた学区(画面に学区名を出すときに使う)
  const district = districts.find((item) => item.id === schoolDistrictId) ?? null
  // 保存に使う学区。一覧を読み込む前(や読み込めないとき)は、保存済みの値をそのまま使う(サーバーが存在を確かめる)
  const districtIdForSave = districtsStatus === 'ready' ? district?.id ?? null : schoolDistrictId

  return {
    prefecture,
    city,
    schoolDistrictId,
    district,
    districtIdForSave,
    cities,
    districts,
    citiesStatus,
    districtsStatus,
    citiesError: citiesStatus === 'error' ? describeRegionRequestError(citiesQuery.error) : null,
    districtsError: districtsStatus === 'error' ? describeRegionRequestError(districtsQuery.error) : null,
    changePrefecture,
    changeCity,
    changeDistrict,
    retryCities,
    retryDistricts,
  }
}

export type SchoolDistrictPicker = ReturnType<typeof useSchoolDistrictPicker>
