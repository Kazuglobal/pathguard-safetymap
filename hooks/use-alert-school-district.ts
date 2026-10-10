"use client"

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { getStoredCity, getStoredRegion, getStoredSchoolDistrict, NATIONWIDE, setStoredCity, setStoredRegion, setStoredSchoolDistrict } from '@/lib/user-region'
import { syncPushSubscriptionRegion } from '@/hooks/use-push-subscription'
import type { SchoolDistrictOptions } from '@/lib/school-districts'

export function useAlertSchoolDistrict() {
  const [mounted, setMounted] = useState(false)
  const [prefecture, setPrefecture] = useState('')
  const [city, setCity] = useState<string | null>(null)
  const [districtId, setDistrictId] = useState<string | null>(null)
  useEffect(() => {
    const pref = getStoredRegion()
    const restoredCity = pref === NATIONWIDE ? null : getStoredCity(pref)
    setPrefecture(pref === NATIONWIDE ? '' : pref)
    setCity(restoredCity)
    setDistrictId(getStoredSchoolDistrict(pref, restoredCity))
    setMounted(true)
  }, [])
  const key = mounted && prefecture ? `/api/school-districts?${new URLSearchParams({ prefecture, ...(city ? { city } : {}) })}` : null
  const { data, error, isLoading, mutate } = useSWR<SchoolDistrictOptions>(key, async (url: string) => {
    const response = await fetch(url, { credentials: 'same-origin' })
    if (!response.ok) throw new Error('学区情報を取得できませんでした')
    return response.json()
  }, { keepPreviousData: false })
  const district = data?.districts.find(item => item.id === districtId && item.prefecture === prefecture && item.city === city) ?? null
  useEffect(() => {
    if (!data || isLoading || error) return
    if (city && !data.cities.includes(city)) {
      setCity(null); setDistrictId(null)
      setStoredCity(prefecture, null); setStoredSchoolDistrict(prefecture, null, null)
    } else if (districtId && !data.districts.some(item => item.id === districtId)) {
      setDistrictId(null); setStoredSchoolDistrict(prefecture, city, null)
    }
  }, [data, isLoading, error, city, districtId, prefecture])
  return {
    mounted, prefecture, city, districtId: district?.id ?? '', district,
    cities: data?.cities ?? [], districts: data?.districts ?? [], isLoading, error,
    unsupported: Boolean(data && (!data.cities.length || (city && !data.districts.length))),
    retry: () => { void mutate() },
    changePrefecture(pref: string) {
      setPrefecture(pref); setCity(null); setDistrictId(null)
      setStoredRegion(pref || NATIONWIDE); setStoredCity(pref, null); setStoredSchoolDistrict(pref, null, null)
      void syncPushSubscriptionRegion(pref || NATIONWIDE)
    },
    changeCity(nextCity: string) {
      setCity(nextCity || null); setDistrictId(null)
      setStoredCity(prefecture, nextCity || null); setStoredSchoolDistrict(prefecture, nextCity || null, null)
    },
    changeDistrict(id: string) {
      setDistrictId(id || null); setStoredSchoolDistrict(prefecture, city, id || null)
    },
  }
}
