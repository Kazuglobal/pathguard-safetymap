/// <reference types="@turf/turf" />
"use client"

import { useState, useEffect, useRef } from "react"
import mapboxgl, { LngLatLike } from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
// import * as turf from "@turf/turf" // 型問題回避のため個別 import に分割
import { useSupabase } from "@/components/providers/supabase-provider"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, Car, HelpCircle, Shield } from "lucide-react"
import shuffle from "lodash.shuffle"
import { addPoints } from "@/lib/gamification"
import type { DangerReport } from "@/lib/types"
import bbox from "@turf/bbox"
import bufferTurf from "@turf/buffer"
import booleanPointInPolygon from "@turf/boolean-point-in-polygon"
import { point as turfPoint } from "@turf/helpers"

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ""
mapboxgl.accessToken = MAPBOX_TOKEN

export default function RouteQuizPage() {
  const { supabase } = useSupabase()

  /** Mapbox GL コンテナ */
  const mapContainer = useRef<HTMLDivElement>(null)
  /** Mapbox GL インスタンス */
  const map = useRef<mapboxgl.Map | null>(null)

  const [hazards, setHazards] = useState<DangerReport[]>([])
  const [startPt, setStartPt] = useState<[number, number] | null>(null)
  const [endPt, setEndPt] = useState<[number, number] | null>(null)
  const [routeLine, setRouteLine] = useState<GeoJSON.LineString | null>(null)
  const [quizList, setQuizList] = useState<DangerReport[]>([])
  const [step, setStep] = useState<"select" | "quiz" | "result">("select")
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)

  /* ---------------------------------------------------------- */
  /*  1. 危険レポート取得                                       */
  /* ---------------------------------------------------------- */
  useEffect(() => {
    const fetchHazards = async () => {
      const { data } = await supabase
        .from("danger_reports")
        .select("id, latitude, longitude, danger_type")
      setHazards((data as DangerReport[]) ?? [])
    }
    fetchHazards()
  }, [supabase])

  /* ---------------------------------------------------------- */
  /*  2. マップ初期化                                           */
  /* ---------------------------------------------------------- */
  useEffect(() => {
    if (map.current || !mapContainer.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [139.767, 35.681], // 東京駅
      zoom: 12,
    })

    // クリックでスタートとゴール設定
    map.current.on("click", (e) => {
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      if (!startPt) {
        setStartPt(lngLat)
      } else if (!endPt) {
        setEndPt(lngLat)
      }
    })
  }, [startPt, endPt])

  /* ---------------------------------------------------------- */
  /*  3. スタート / ゴールマーカー描画                          */
  /* ---------------------------------------------------------- */
  useEffect(() => {
    if (!map.current) return

    let style: mapboxgl.Style | undefined
    try {
      style = map.current.getStyle()
    } catch {
      return // style 未設定のタイミング
    }

    /* ---------- 既存マーカー削除 ---------- */
    ;(style.layers ?? []).forEach((layer: mapboxgl.AnyLayer) => {
      if (layer.id.startsWith("marker-")) {
        try {
          map.current?.removeLayer(layer.id)
        } catch {
          /* レイヤーが存在しない場合は無視 */
        }
      }
    })

    ;(style.sources ?? {}) &&
      Object.keys(style.sources).forEach((srcKey) => {
        if (srcKey.startsWith("marker-")) {
          try {
            map.current?.removeSource(srcKey)
          } catch {
            /* ソースが存在しない場合は無視 */
          }
        }
      })

    /* ---------- マーカー追加関数 ---------- */
    const addMarker = (pt: [number, number], id: string, color: string) => {
      map.current!.addSource(id, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: pt,
              },
              properties: {},
            },
          ],
        } as GeoJSON.FeatureCollection,
      })
      map.current!.addLayer({
        id,
        type: "circle",
        source: id,
        paint: {
          "circle-radius": 6,
          "circle-color": color,
        },
      })
    }

    if (startPt) addMarker(startPt, "marker-start", "#38bdf8") // 水色
    if (endPt) addMarker(endPt, "marker-end", "#f87171") // 赤
  }, [startPt, endPt])

  /* ---------------------------------------------------------- */
  /*  4. ルート取得                                             */
  /* ---------------------------------------------------------- */
  useEffect(() => {
    const getRoute = async () => {
      if (!startPt || !endPt) return

      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${startPt[0]},${startPt[1]};${endPt[0]},${endPt[1]}?geometries=geojson&access_token=${MAPBOX_TOKEN}`
      const res = await fetch(url)
      const data = await res.json()
      const line = data.routes?.[0]?.geometry as GeoJSON.LineString
      if (!line) return
      setRouteLine(line)
    }
    getRoute()
  }, [startPt, endPt])

  /* ---------------------------------------------------------- */
  /*  5. ルート描画 & クイズリスト作成                          */
  /* ---------------------------------------------------------- */
  useEffect(() => {
    if (!map.current || !routeLine) return

    // 既存ルート削除
    if (map.current.getLayer("route-line")) map.current.removeLayer("route-line")
    if (map.current.getSource("route")) map.current.removeSource("route")

    // ルート描画
    map.current.addSource("route", {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: routeLine,
        properties: {},
      } as GeoJSON.Feature,
    })
    map.current.addLayer({
      id: "route-line",
      type: "line",
      source: "route",
      paint: {
        "line-color": "#4f46e5",
        "line-width": 4,
      },
    })

    // ルートに合わせてズーム
    const [minX, minY, maxX, maxY] = bbox(routeLine)
    map.current.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      { padding: 40 },
    )

    // 50 m バッファで近くの危険箇所抽出
    const buffered = bufferTurf(routeLine, 0.05, { units: "kilometers" })
    const near = hazards.filter((h) =>
      booleanPointInPolygon(turfPoint([h.longitude, h.latitude]), buffered),
    )
    setQuizList(shuffle(near))
  }, [routeLine, hazards])

  /* ---------------------------------------------------------- */
  /*  6. クイズロジック                                         */
  /* ---------------------------------------------------------- */
  const startQuiz = () => {
    if (quizList.length === 0) {
      alert(
        "ルート付近に危険箇所がありません！別ルートで試してください。",
      )
      return
    }
    setStep("quiz")
  }

  const hazardIcon = (type: string) => {
    switch (type) {
      case "traffic":
        return <Car className="h-20 w-20 text-blue-600" />
      case "crime":
        return <Shield className="h-20 w-20 text-red-600" />
      case "disaster":
        return <AlertTriangle className="h-20 w-20 text-orange-500" />
      default:
        return <HelpCircle className="h-20 w-20 text-gray-600" />
    }
  }

  const answer = async (choice: string) => {
    const current = quizList[idx]
    const correct = current.danger_type === choice

    if (correct) setScore((s) => s + 10)

    // 最終問題か判定
    const isLast = idx + 1 === quizList.length
    if (isLast) {
      setStep("result")
      // ポイント付与
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user)
          await addPoints(supabase, user.id, correct ? 10 : 0)
      } catch (e) {
        console.error(e)
      }
    } else {
      setIdx((i) => i + 1)
    }
  }

  /* ---------------------------------------------------------- */
  /*  7. UI                                                     */
  /* ---------------------------------------------------------- */
  return (
    <div className="flex h-screen flex-col">
      {/* ヘッダー */}
      <header className="flex-none border-b bg-white p-2 text-center font-bold">
        ルートクイズ
      </header>

      <div className="flex flex-1">
        {/* Map */}
        <div ref={mapContainer} className="flex-1" />

        {/* サイドパネル */}
        <aside className="w-80 max-w-full overflow-y-auto border-l bg-white p-4">
          {step === "select" && (
            <>
              <h2 className="mb-2 font-medium">スタート / ゴールを選択</h2>
              <p className="mb-2 text-sm">
                地図をクリックして 2&nbsp;点を指定してください。
              </p>
              <ul className="mb-4 text-sm">
                <li>
                  スタート:&nbsp;
                  {startPt
                    ? `${startPt[1].toFixed(4)},${startPt[0].toFixed(4)}`
                    : "未設定"}
                </li>
                <li>
                  ゴール:&nbsp;
                  {endPt
                    ? `${endPt[1].toFixed(4)},${endPt[0].toFixed(4)}`
                    : "未設定"}
                </li>
              </ul>
              <Button
                onClick={startQuiz}
                disabled={!routeLine}
                className="w-full"
              >
                クイズ開始
              </Button>
            </>
          )}

          {step === "quiz" && (
            <>
              <h2 className="mb-2 font-medium">
                問題 {idx + 1} / {quizList.length}
              </h2>

              <div className="mb-4 flex justify-center">
                {hazardIcon(quizList[idx].danger_type)}
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2">
                {[
                  { label: "交通危険", value: "traffic" },
                  { label: "犯罪危険", value: "crime" },
                  { label: "災害危険", value: "disaster" },
                  { label: "その他", value: "other" },
                ].map((opt) => (
                  <Button
                    key={opt.value}
                    variant="outline"
                    onClick={() => answer(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>

              <Progress value={((idx + 1) / quizList.length) * 100} />
            </>
          )}

          {step === "result" && (
            <>
              <h2 className="mb-4 font-medium">クイズ終了！</h2>
              <p className="mb-4 text-center text-2xl font-bold">
                {score} 点ゲット！
              </p>
              <Button className="w-full" onClick={() => location.reload()}>
                もう一度遊ぶ
              </Button>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
