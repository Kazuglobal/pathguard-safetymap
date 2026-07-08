"use client"

import { useEffect, useRef, useState } from "react"
import { useCurrentLocation } from "@/hooks/use-current-location"
import {
  getCurrentLocationMapView,
  getFallbackMapView,
  resolveInitialMapView,
  type InitialMapView,
} from "@/lib/map-center"
import type { UserRoute } from "@/lib/types"

/** ルート取得がこの時間を超えたら待たずにフォールバックで初期化する */
const ROUTES_WAIT_TIMEOUT_MS = 4000

interface UseInitialMapViewArgs {
  primaryRoute: UserRoute | null
  routes: UserRoute[]
  isRoutesLoading: boolean
}

export interface UseInitialMapViewReturn {
  /**
   * マップ初期化に使う値。null の間は初期化を待つ
   * （ルート取得中のみ。取得完了かタイムアウトで必ず非nullになる）
   */
  initialView: InitialMapView | null
  /**
   * フォールバックで初期化した後に現在地が取れた場合の移動先（[lng, lat]）。
   * 一度だけ非nullに変わる。
   */
  lateCurrentLocation: [number, number] | null
}

/**
 * 地図の初期表示センターを「登録ルート → 現在地 → 東京」の優先順で決める。
 *
 * 登録ルートがある場合はルート取得完了を待ってから初期化するため東京は見えない。
 * ルートが無い場合は東京フォールバックで即初期化しつつ現在地を要求し、
 * 取得でき次第 lateCurrentLocation 経由で flyTo してもらう
 * （GPSは許可プロンプトで長時間ブロックしうるため初期化は待たない）。
 */
export function useInitialMapView({
  primaryRoute,
  routes,
  isRoutesLoading,
}: UseInitialMapViewArgs): UseInitialMapViewReturn {
  const { location, requestLocation } = useCurrentLocation({ showErrorToast: false })
  const [initialView, setInitialView] = useState<InitialMapView | null>(null)
  const [lateCurrentLocation, setLateCurrentLocation] = useState<[number, number] | null>(null)
  const gpsRequestedRef = useRef(false)

  // ルート取得完了で初期ビューを確定する
  useEffect(() => {
    if (initialView || isRoutesLoading) return

    setInitialView(resolveInitialMapView({ primaryRoute, routes, currentLocation: location }))
  }, [initialView, isRoutesLoading, primaryRoute, routes, location])

  // ルート取得が長引く場合の安全弁（無限ローディング防止）。
  // タイムアウト後にルートが届いても再センタリングはしない（初期表示は一度だけ決める）。
  useEffect(() => {
    if (initialView || !isRoutesLoading) return

    const timer = window.setTimeout(() => {
      setInitialView((view) => view ?? getFallbackMapView())
    }, ROUTES_WAIT_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [initialView, isRoutesLoading])

  // フォールバックで初期化した場合（通常経路・タイムアウト経路とも）は現在地を一度だけ要求する
  useEffect(() => {
    if (initialView?.source !== "fallback" || gpsRequestedRef.current) return

    gpsRequestedRef.current = true
    requestLocation()
  }, [initialView, requestLocation])

  // フォールバック初期化後に現在地が届いたら移動先として一度だけ公開する
  useEffect(() => {
    if (initialView?.source !== "fallback" || lateCurrentLocation) return

    const view = getCurrentLocationMapView(location)
    if (view) {
      setLateCurrentLocation(view.center)
    }
  }, [initialView, lateCurrentLocation, location])

  return { initialView, lateCurrentLocation }
}
