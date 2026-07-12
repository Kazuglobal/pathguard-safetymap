"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import * as turf from "@turf/turf"
import { useSupabase } from "@/components/providers/supabase-provider"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, Car, Check, HelpCircle, MapPin, RotateCcw, Shield } from "lucide-react"
import shuffle from "lodash.shuffle"
import { addPoints } from "@/lib/gamification"
import type { DangerReport } from "@/lib/types"
import { canStartRouteQuiz, selectNextQuizPoint } from "@/lib/route-quiz-selection"
import { useEventCallback } from "@/hooks/use-event-callback"
import { tankenTokens, PAPER_NOISE } from "@/lib/design/tanken"

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ""
mapboxgl.accessToken = MAPBOX_TOKEN

export default function RouteQuizPage() {
  const { supabase } = useSupabase()

  /** Mapbox GL コンテナ */
  const mapContainer = useRef<HTMLDivElement>(null)
  /** Mapbox GL インスタンス */
  const map = useRef<mapboxgl.Map | null>(null)
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const endMarkerRef = useRef<mapboxgl.Marker | null>(null)

  const [hazards, setHazards] = useState<DangerReport[]>([])
  const [startPt, setStartPt] = useState<[number, number] | null>(null)
  const [endPt, setEndPt] = useState<[number, number] | null>(null)
  const [routeLine, setRouteLine] = useState<GeoJSON.LineString | null>(null)
  const [quizList, setQuizList] = useState<DangerReport[]>([])
  const [step, setStep] = useState<"select" | "quiz" | "result">("select")
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading")
  const [mapMessage, setMapMessage] = useState("")
  const [mapRetryKey, setMapRetryKey] = useState(0)

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
  // 初期化時に一度だけ登録するハンドラでも最新 state を読めるよう useEventCallback を使う
  // (state同期refの新設は禁止: hooks/use-event-callback.ts 参照)
  const handleMapClick = useEventCallback((e: mapboxgl.MapMouseEvent) => {
    const point: [number, number] = [e.lngLat.lng, e.lngLat.lat]
    const next = selectNextQuizPoint({ start: startPt, end: endPt }, point)

    if (next.start !== startPt) {
      setStartPt(next.start)
      return
    }

    if (next.end !== endPt) {
      setEndPt(next.end)
      if (next.start && next.end) {
        setRouteLine({ type: "LineString", coordinates: [next.start, next.end] })
      }
    }
  })

  useEffect(() => {
    if (map.current || !mapContainer.current) return

    if (!MAPBOX_TOKEN) {
      setMapStatus("error")
      setMapMessage("地図の設定を確認できませんでした。時間をおいてもう一度ためしてください。")
      return
    }

    setMapStatus("loading")
    setMapMessage("")

    const instance = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [139.767, 35.681],
      zoom: 12,
    })
    map.current = instance

    const handleLoad = () => setMapStatus("ready")
    const handleError = () => {
      setMapStatus("error")
      setMapMessage("地図を読み込めませんでした。通信状態を確認して、もう一度ためしてください。")
    }
    instance.on("load", handleLoad)
    instance.on("error", handleError)
    instance.on("click", handleMapClick)

    return () => {
      startMarkerRef.current?.remove()
      endMarkerRef.current?.remove()
      startMarkerRef.current = null
      endMarkerRef.current = null
      instance.off("load", handleLoad)
      instance.off("error", handleError)
      instance.off("click", handleMapClick)
      instance.remove()
      if (map.current === instance) map.current = null
    }
  }, [mapRetryKey, handleMapClick])

  /* ---------------------------------------------------------- */
  /*  3. スタート / ゴールマーカー描画                          */
  /* ---------------------------------------------------------- */
  useEffect(() => {
    if (!map.current || mapStatus !== "ready") return

    const makeMarker = (number: string, color: string, label: string) => {
      const element = document.createElement("button")
      element.type = "button"
      element.textContent = number
      element.setAttribute("aria-label", label)
      element.className = "grid h-12 w-12 place-items-center rounded-full border-4 border-white text-lg font-black text-white shadow-lg"
      element.style.background = color
      return element
    }

    startMarkerRef.current?.remove()
    endMarkerRef.current?.remove()
    startMarkerRef.current = startPt
      ? new mapboxgl.Marker({ element: makeMarker("1", tankenTokens.color.primary, "スタート地点") }).setLngLat(startPt).addTo(map.current)
      : null
    endMarkerRef.current = endPt
      ? new mapboxgl.Marker({ element: makeMarker("2", tankenTokens.color.accent, "ゴール地点") }).setLngLat(endPt).addTo(map.current)
      : null

    return () => {
      startMarkerRef.current?.remove()
      endMarkerRef.current?.remove()
      startMarkerRef.current = null
      endMarkerRef.current = null
    }
  }, [startPt, endPt, mapStatus])

  /* ---------------------------------------------------------- */
  /*  4. ルート取得                                             */
  /* ---------------------------------------------------------- */
  useEffect(() => {
    if (!startPt || !endPt) return

    // controller は effect の同期スコープで生成する。async 関数内で生成して
    // 完了後に返す形だと、リクエスト飛行中の cleanup が abort できず、
    // 遅延レスポンスが新しい選択のルートを上書きするレースが起きる。
    const controller = new AbortController()

    const getRoute = async () => {
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${startPt[0]},${startPt[1]};${endPt[0]},${endPt[1]}?geometries=geojson&access_token=${MAPBOX_TOKEN}`
      try {
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) throw new Error("directions_failed")
        const data = await res.json()
        if (controller.signal.aborted) return
        const line = data.routes?.[0]?.geometry as GeoJSON.LineString
        if (line) setRouteLine(line)
      } catch (error) {
        if (controller.signal.aborted) return
        if (error instanceof DOMException && error.name === "AbortError") return
        setMapMessage("道順を取得できなかったため、2地点を直線で確認しています。クイズは続けられます。")
      }
    }

    void getRoute()
    return () => controller.abort()
  }, [startPt, endPt])

  /* ---------------------------------------------------------- */
  /*  5. ルート描画 & クイズリスト作成                          */
  /* ---------------------------------------------------------- */
  useEffect(() => {
    const instance = map.current
    if (!instance || !routeLine || mapStatus !== "ready") return

    const draw = () => {
      // 既存ルート削除
      if (instance.getLayer("route-line")) instance.removeLayer("route-line")
      if (instance.getSource("route")) instance.removeSource("route")

      // ルート描画
      instance.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: routeLine,
          properties: {},
        } as GeoJSON.Feature,
      })
      instance.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#4f46e5",
          "line-width": 4,
        },
      })

      // ルートに合わせてズーム
      const turfAny = turf as any
      const [minX, minY, maxX, maxY] = turfAny.bbox(routeLine)
      instance.fitBounds(
        [
          [minX, minY],
          [maxX, maxY],
        ],
        { padding: 40 },
      )

      // 50 m バッファで近くの危険箇所抽出
      const buffered = turfAny.buffer(routeLine, 0.05, { units: "kilometers" })
      const near = hazards.filter((h) =>
        turfAny.booleanPointInPolygon(turfAny.point([h.longitude, h.latitude]), buffered!),
      )
      setQuizList(shuffle(near))
    }

    // タイル読込中などで isStyleLoaded() が false の瞬間は idle を待って再試行する。
    // ここで単に return すると依存値が変わらない限り再実行されず、
    // ルート未描画・quizList 空のままボタンだけ押せる状態になる。
    if (!instance.isStyleLoaded()) {
      instance.once("idle", draw)
      return () => {
        instance.off("idle", draw)
      }
    }

    draw()
  }, [routeLine, hazards, mapStatus])

  const resetPoints = useCallback(() => {
    setStartPt(null)
    setEndPt(null)
    setRouteLine(null)
    setQuizList([])
    setMapMessage("")
    if (map.current?.getLayer("route-line")) map.current.removeLayer("route-line")
    if (map.current?.getSource("route")) map.current.removeSource("route")
  }, [])

  const resetEndPoint = useCallback(() => {
    setEndPt(null)
    setRouteLine(null)
    setQuizList([])
    if (map.current?.getLayer("route-line")) map.current.removeLayer("route-line")
    if (map.current?.getSource("route")) map.current.removeSource("route")
  }, [])

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
  const selectionReady = canStartRouteQuiz({ start: startPt, end: endPt })
  const t = tankenTokens

  return (
    <div className="flex h-[100dvh] min-h-[640px] flex-col" style={{ backgroundColor: t.color.paper, backgroundImage: PAPER_NOISE, color: t.color.ink }}>
      {/* ヘッダー */}
      <header className="flex-none border-b px-4 py-3 text-center text-lg font-black" style={{ background: t.color.card, borderColor: t.border.faint }}>
        つうがくろ クイズ
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Map */}
        <section className="relative h-[52dvh] min-h-[320px] w-full shrink-0 md:h-auto md:min-h-0 md:flex-1" aria-label="スタートとゴールを選ぶ地図">
          <div ref={mapContainer} className="h-full w-full" data-testid="route-quiz-map" />
          {mapStatus !== "ready" && (
            <div className="absolute inset-0 grid place-items-center bg-[#FBF5E9]/90 p-6 text-center" aria-live="polite">
              <div>
                <MapPin className="mx-auto h-9 w-9" style={{ color: mapStatus === "error" ? t.color.danger : t.color.primary }} aria-hidden="true" />
                <p className="mt-3 font-black">{mapStatus === "loading" ? "ちずを じゅんびしています…" : "ちずを ひらけませんでした"}</p>
                {mapStatus === "error" && (
                  <button
                    type="button"
                    onClick={() => setMapRetryKey((value) => value + 1)}
                    className={`mt-4 inline-flex min-h-12 items-center gap-2 rounded-full px-5 font-black text-white ${t.cls.focus}`}
                    style={{ background: t.color.primary, boxShadow: t.shadow.pressGreen }}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" /> もう一度ためす
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* サイドパネル */}
        <aside className="min-h-0 flex-1 overflow-y-auto border-t p-4 pb-28 md:w-[380px] md:flex-none md:border-l md:border-t-0 md:pb-6" style={{ background: t.color.card, borderColor: t.border.faint }}>
          {step === "select" && (
            <div className="space-y-3">
              <p className="text-center text-sm font-black" style={{ color: t.color.accentStrong }}>ちずを 2かい タップしてね</p>
              <ol className="space-y-2">
                <li className="flex min-h-14 items-center gap-3 rounded-[18px] border p-3" style={{ background: t.color.primarySoft, borderColor: "rgba(21,158,114,.25)" }}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg font-black text-white" style={{ background: t.color.primary }}>1</span>
                  <span className="min-w-0 flex-1 font-black">① スタートをえらぶ</span>
                  {startPt && <Check className="h-5 w-5" style={{ color: t.color.primaryStrong }} aria-label="えらびました" />}
                </li>
                <li className="flex min-h-14 items-center gap-3 rounded-[18px] border p-3" style={{ background: t.color.accentSoft, borderColor: "rgba(244,128,31,.25)" }}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg font-black text-white" style={{ background: t.color.accent }}>2</span>
                  <span className="min-w-0 flex-1 font-black">② ゴールをえらぶ</span>
                  {endPt && <Check className="h-5 w-5" style={{ color: t.color.accentStrong }} aria-label="えらびました" />}
                </li>
              </ol>
              {mapMessage && <p role="status" className="rounded-[14px] border px-3 py-2 text-xs font-bold" style={{ background: t.color.sunSoft, borderColor: t.color.sunDeep }}>{mapMessage}</p>}
              <div className="flex gap-2">
                {endPt && (
                  <button type="button" onClick={resetEndPoint} className={`min-h-11 flex-1 rounded-full border px-3 text-sm font-bold ${t.cls.focus}`} style={{ borderColor: t.border.soft }}>ゴールを選び直す</button>
                )}
                {startPt && (
                  <button type="button" onClick={resetPoints} className={`min-h-11 flex-1 rounded-full border px-3 text-sm font-bold ${t.cls.focus}`} style={{ borderColor: t.border.soft }}>はじめから</button>
                )}
              </div>
              <Button
                onClick={startQuiz}
                disabled={!selectionReady}
                className={`min-h-14 w-full rounded-full text-lg font-black ${t.cls.focus}`}
                style={{ background: selectionReady ? t.color.primary : t.color.inkFaint, boxShadow: selectionReady ? t.shadow.pressGreen : "none" }}
              >
                クイズをはじめる
              </Button>
              {!selectionReady && <p className="text-center text-xs font-bold" style={{ color: t.color.inkSoft }}>スタートとゴールをえらぶと押せるよ</p>}
            </div>
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
