"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Map, { Marker } from "react-map-gl/mapbox"
import type { MapRef } from "react-map-gl/mapbox"
import "mapbox-gl/dist/mapbox-gl.css"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowLeft, ImageOff, MapPin, RefreshCw, Sparkles, Trash2 } from "lucide-react"

import { splitFurigana } from "@/lib/hunter/furigana"
import { localizeMapLabels } from "@/lib/hunter/map-labels"
import { BottomBar, Mascot, PrimaryCTA, tokens } from "./theme"
import { RubyText } from "./ruby-text"

/**
 * たんけんの きろく(危険マップ)画面。
 *
 * - GET /api/hunter/photos で「自分の写真」だけを取得して、地図とリストで見せる。
 * - DELETE /api/hunter/photo/{id} で 1枚ずつ消せる(まちがい防止に かくにん2ステップ)。
 * - 署名URL(signedUrl)は短TTL。読み込めない場合も一覧は壊さない。
 * - Mapbox トークンが無い / 取得失敗でも、リストだけで使える(throwしない)。
 */

const C = tokens.color

interface HunterPhoto {
  id: string
  pinLat: number | null
  pinLng: number | null
  capturedAt: string | null
  masked: boolean
  retentionUntil: string | null
  createdAt: string
  signedUrl: string | null
  /** みつけた危険の種類(チップ表示)。 */
  dangers?: string[]
  /** 最大 severity(ピンの色分け)。 */
  topSeverity?: string | null
}

/** severity → ピン/チップの色。 */
function severityColor(severity: string | null | undefined): string {
  if (severity === "high") return C.danger
  if (severity === "medium") return C.accent
  return C.primary
}

type Status = "loading" | "ready" | "error"

const DEFAULT_CENTER = { latitude: 35.68, longitude: 139.76 }

export function DangerMapScreen({
  onBack,
  onPlayNew,
}: {
  onBack: () => void
  onPlayNew: () => void
}) {
  const mapToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  const mapRef = useRef<MapRef | null>(null)
  const reduce = useReducedMotion()

  const [status, setStatus] = useState<Status>("loading")
  const [photos, setPhotos] = useState<readonly HunterPhoto[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  /** ラベルを日本語優先にする(子ども向け: 英語表記を避ける)。 */
  const localizeLabels = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    try {
      localizeMapLabels(map)
    } catch {
      // 失敗しても地図機能は損なわない
    }
  }, [])

  const load = useCallback(async () => {
    setStatus("loading")
    setErrorMsg(null)
    try {
      const response = await fetch("/api/hunter/photos")
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setErrorMsg(body?.error ?? "きろくを よみこめませんでした。")
        setStatus("error")
        return
      }
      setPhotos(Array.isArray(body?.photos) ? body.photos : [])
      setStatus("ready")
    } catch {
      setErrorMsg("つうしんエラーが おきました。もう一度ためしてね。")
      setStatus("error")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const pinned = useMemo(
    () =>
      photos.filter(
        (p): p is HunterPhoto & { pinLat: number; pinLng: number } =>
          typeof p.pinLat === "number" && typeof p.pinLng === "number",
      ),
    [photos],
  )

  const initialViewState = useMemo(() => {
    const first = pinned[0]
    return {
      latitude: first?.pinLat ?? DEFAULT_CENTER.latitude,
      longitude: first?.pinLng ?? DEFAULT_CENTER.longitude,
      zoom: first ? 13 : 9,
    }
  }, [pinned])

  // ピンが複数あるときは全部が見えるように地図をあわせる
  useEffect(() => {
    if (status !== "ready" || pinned.length < 2) return
    const map = mapRef.current
    if (!map) return
    const lats = pinned.map((p) => p.pinLat)
    const lngs = pinned.map((p) => p.pinLng)
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 56, maxZoom: 15, duration: 700 },
    )
  }, [status, pinned])

  const handleFocus = useCallback((photo: HunterPhoto) => {
    setActiveId(photo.id)
    if (typeof photo.pinLat === "number" && typeof photo.pinLng === "number") {
      mapRef.current?.flyTo({
        center: [photo.pinLng, photo.pinLat],
        zoom: 16,
        duration: 700,
      })
    }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id)
    try {
      const response = await fetch(`/api/hunter/photo/${id}`, { method: "DELETE" })
      if (!response.ok) {
        setErrorMsg("けすのに しっぱいしました。もう一度ためしてね。")
        return
      }
      setPhotos((prev) => prev.filter((p) => p.id !== id))
      setConfirmId(null)
    } catch {
      setErrorMsg("つうしんエラーが おきました。もう一度ためしてね。")
    } finally {
      setDeletingId(null)
    }
  }, [])

  // ----- 画面の中身 -----

  if (status === "loading") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <Mascot size="md" mood="think" />
        <p className="text-[15px] font-black" style={{ color: C.ink }}>
          きろくを よみこみ中…
        </p>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
        <Mascot size="md" mood="think" />
        <p className="text-[15px] font-bold leading-relaxed" style={{ color: C.ink }}>
          {errorMsg ?? "きろくを よみこめませんでした。"}
        </p>
        <PrimaryCTA variant="green" onClick={() => void load()}>
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
          もう一度 よみこむ
        </PrimaryCTA>
        <BackButton onBack={onBack} />
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 py-8 text-center">
        {/* 空っぽのノート(生成イラスト) */}
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[300px] overflow-hidden rounded-[20px] border bg-white p-2"
          style={{ borderColor: "rgba(67,57,43,.09)", boxShadow: tokens.shadow.card }}
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[13px]">
            <Image
              src="/images/hunter/records-empty.png"
              alt="まっしろな たんけんノートと ルペ"
              fill
              sizes="300px"
              className="object-cover"
              draggable={false}
            />
          </div>
        </motion.div>
        <div>
          <h2 className="text-[19px] font-black" style={{ color: C.ink }}>
            きろくは まだ まっしろ
          </h2>
          <p className="mt-2 text-[14px] font-bold leading-relaxed" style={{ color: C.inkSoft }}>
            <RubyText text="写真" />を しらべるとき「きろくに のこす」を オンにすると、ここに たんけんの あしあとが たまっていくよ。
          </p>
        </div>
        <div className="flex w-full flex-col gap-2.5">
          <PrimaryCTA onClick={onPlayNew}>
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            さいしょの 1まいを しらべる
          </PrimaryCTA>
          <BackButton onBack={onBack} />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl min-h-full flex-1 flex-col px-4 pt-1">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* 地図(トークンが無いときは出さない) */}
        {mapToken && (
          <div
            className="relative h-[200px] w-full shrink-0 overflow-hidden rounded-[18px] border-4 md:h-[280px]"
            style={{ borderColor: "#fff", boxShadow: tokens.shadow.card }}
          >
            <Map
              ref={mapRef}
              mapboxAccessToken={mapToken}
              mapStyle="mapbox://styles/mapbox/streets-v12"
              initialViewState={initialViewState}
              attributionControl={false}
              onLoad={localizeLabels}
              style={{ width: "100%", height: "100%" }}
            >
              {pinned.map((p) => (
                <Marker key={p.id} latitude={p.pinLat} longitude={p.pinLng} anchor="bottom">
                  <button
                    type="button"
                    onClick={() => handleFocus(p)}
                    aria-label="きろくの ばしょ"
                    className={`grid place-items-center rounded-full text-white transition-all ${tokens.cls.focus}`}
                    style={{
                      height: p.id === activeId ? 44 : 36,
                      width: p.id === activeId ? 44 : 36,
                      background: p.id === activeId ? C.sunDeep : severityColor(p.topSeverity),
                      boxShadow: `0 0 0 3px #fff, ${tokens.shadow.card}`,
                    }}
                  >
                    <MapPin className="h-5 w-5" aria-hidden="true" strokeWidth={2.5} />
                  </button>
                </Marker>
              ))}
            </Map>
          </div>
        )}

        {errorMsg && (
          <p
            role="alert"
            className="rounded-[14px] px-4 py-3 text-[13.5px] font-black"
            style={{ background: C.dangerSoft, color: C.danger }}
          >
            {errorMsg}
          </p>
        )}

        {/* リスト */}
        <ul className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pb-2">
          {photos.map((photo) => (
            <PhotoRow
              key={photo.id}
              photo={photo}
              active={photo.id === activeId}
              confirming={photo.id === confirmId}
              deleting={photo.id === deletingId}
              onFocus={() => handleFocus(photo)}
              onAskDelete={() => setConfirmId(photo.id)}
              onCancelDelete={() => setConfirmId(null)}
              onConfirmDelete={() => void handleDelete(photo.id)}
            />
          ))}
        </ul>
      </div>

      <BottomBar className="-mx-4 px-4">
        <div className="flex flex-col gap-2">
          <PrimaryCTA onClick={onPlayNew}>
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            あたらしく しゃしんを しらべる
          </PrimaryCTA>
          <BackButton onBack={onBack} />
        </div>
      </BottomBar>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * もどるボタン(共通・タップ領域 大きめ)
 * ------------------------------------------------------------------ */

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full px-6 text-[14px] font-black ${tokens.cls.focus}`}
      style={{ color: C.primaryStrong }}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      もどる
    </button>
  )
}

/* ------------------------------------------------------------------ *
 * 1枚分のカード
 * ------------------------------------------------------------------ */

function PhotoRow({
  photo,
  active,
  confirming,
  deleting,
  onFocus,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  photo: HunterPhoto
  active: boolean
  confirming: boolean
  deleting: boolean
  onFocus: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
}) {
  const reduce = useReducedMotion()
  const dateText = formatDate(photo.capturedAt ?? photo.createdAt)
  const hasPin = typeof photo.pinLat === "number" && typeof photo.pinLng === "number"

  return (
    <li>
      <motion.div
        layout={reduce ? false : undefined}
        className="flex items-center gap-3 rounded-[18px] border bg-white p-2.5"
        style={{
          borderColor: active ? C.sunDeep : "rgba(67,57,43,.09)",
          boxShadow: active ? `0 0 0 2px ${C.sun}, ${tokens.shadow.soft}` : tokens.shadow.soft,
        }}
      >
        <button
          type="button"
          onClick={onFocus}
          aria-label="この きろくを 地図で 見る"
          className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-[12px] ${tokens.cls.focus}`}
          style={{ background: C.paperDeep }}
        >
          {photo.signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.signedUrl}
              alt="きろくした しゃしん"
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <span className="grid h-full w-full place-items-center" style={{ color: C.inkFaint }}>
              <ImageOff className="h-6 w-6" aria-hidden="true" />
            </span>
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[13.5px] font-black" style={{ color: C.ink }}>
            {dateText}
          </span>
          <span className="flex items-center gap-1 text-[11.5px] font-bold" style={{ color: C.inkSoft }}>
            <MapPin
              className="h-3.5 w-3.5"
              aria-hidden="true"
              style={{ color: hasPin ? C.primary : C.inkFaint }}
            />
            {hasPin ? "ばしょ あり" : "ばしょ なし"}
          </span>
          {photo.dangers && photo.dangers.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {photo.dangers.map((d, i) => (
                <span
                  key={i}
                  className="rounded-full px-2 py-0.5 text-[10.5px] font-black text-white"
                  style={{ background: severityColor(photo.topSeverity) }}
                >
                  {/* 極小ルビは読めないため、タグ内はかなに開く */}
                  {splitFurigana(d)
                    .map((tk) => tk.r ?? tk.t)
                    .join("")}
                </span>
              ))}
            </span>
          ) : null}
        </div>

        {confirming ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onConfirmDelete}
              disabled={deleting}
              className={`rounded-full px-3.5 py-2.5 text-[12.5px] font-black text-white disabled:opacity-60 ${tokens.cls.focus}`}
              style={{ background: C.danger }}
            >
              {deleting ? "けし中…" : "けす"}
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              disabled={deleting}
              className={`rounded-full px-3.5 py-2.5 text-[12.5px] font-black disabled:opacity-60 ${tokens.cls.focus}`}
              style={{ background: C.paperDeep, color: C.ink }}
            >
              やめる
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAskDelete}
            aria-label="この きろくを けす"
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tokens.cls.focus}`}
            style={{ background: C.paperDeep, color: C.danger }}
          >
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </motion.div>
    </li>
  )
}

function formatDate(iso: string | null) {
  if (!iso) return "ひづけ ふめい"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "ひづけ ふめい"
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}
