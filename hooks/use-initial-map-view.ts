"use client"

import { useEffect, useRef, useState } from "react"
import { useCurrentLocation } from "@/hooks/use-current-location"
import {
  getCurrentLocationMapView,
  getFallbackMapView,
  resolveInitialMapView,
  resolveRouteMapView,
  type InitialMapView,
} from "@/lib/map-center"
import type { UserRoute } from "@/lib/types"

/**
 * ルート取得がこの時間を超えたら待たずにフォールバックで初期化する。
 * 低速の端末では地図の表示がもともと遅いので長く待たない(4秒→1.5秒)。
 * 遅れて届いたルートへは lateRouteView で一度だけ移動する
 */
export const ROUTES_WAIT_TIMEOUT_MS = 1500

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
  /**
   * ルートを待たずに初期化した後でルートが届いた場合の移動先。一度だけ非nullに変わる。
   * (利用者がすでに地図を動かしていたら、呼び出し側で無視する)
   */
  lateRouteView: InitialMapView | null
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
  const [lateRouteView, setLateRouteView] = useState<InitialMapView | null>(null)
  const gpsRequestedRef = useRef(false)
  const initializedBeforeRoutesRef = useRef(false)

  // ルート取得完了で初期ビューを確定する
  useEffect(() => {
    if (initialView || isRoutesLoading) return

    setInitialView(resolveInitialMapView({ primaryRoute, routes, currentLocation: location }))
  }, [initialView, isRoutesLoading, primaryRoute, routes, location])

  // ルート取得が長引く場合の安全弁（無限ローディング防止）。
  // 初期表示は一度だけ決める。タイムアウト後に届いたルートへは lateRouteView で移動してもらう。
  useEffect(() => {
    if (initialView || !isRoutesLoading) return

    const timer = window.setTimeout(() => {
      initializedBeforeRoutesRef.current = true
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

  // ルートを待たずに初期化した後でルートが届いたら、そのルートの表示を一度だけ公開する
  useEffect(() => {
    if (!initializedBeforeRoutesRef.current || isRoutesLoading || lateRouteView) return

    const view = resolveRouteMapView(primaryRoute, routes)
    if (view) {
      setLateRouteView(view)
    }
  }, [isRoutesLoading, lateRouteView, primaryRoute, routes])

  return { initialView, lateCurrentLocation, lateRouteView }
}
