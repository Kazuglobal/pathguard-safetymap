"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createPortal } from "react-dom"
import { AlertTriangle, Flag, LocateFixed, MapPin, X } from "lucide-react"
import DangerReportForm from "@/components/danger-report/danger-report-form"
import { useDangerReportSubmit } from "@/hooks/use-danger-report-submit"
import { useSupabase } from "@/components/providers/supabase-provider"
import { useToast } from "@/components/ui/use-toast"
import { tankenTokens } from "@/lib/design/tanken"

export default function ReportComposer() {
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null)
  const [locationSource, setLocationSource] = useState<"manual" | "gps" | null>(null)
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "error">("idle")
  const [gpsMessage, setGpsMessage] = useState("")

  useEffect(() => setMounted(true), [])

  // 送信済みプレビューや pending 一覧はこの導線では表示しないため setter は渡さない
  const submitReport = useDangerReportSubmit({
    supabase,
    selectedLocation,
    selectedUserRoute: null,
    toast,
  })

  const close = () => {
    setOpen(false)
    setGpsStatus("idle")
    setGpsMessage("")
    // 前回の位置を持ち越さない(次回GPS失敗時に古い地点で送信されるのを防ぐ)
    setSelectedLocation(null)
    setLocationSource(null)
  }

  const chooseCurrentLocation = () => {
    setOpen(true)
    setGpsMessage("")
    // 取得開始時に前回の位置をクリアする。GPS が失敗したときに
    // 古い地点が「ピンを たてたよ」として残り、そのまま送信できてしまうため。
    setSelectedLocation(null)
    setLocationSource(null)

    if (!navigator.geolocation) {
      setGpsStatus("error")
      setGpsMessage("この端末では現在地を使えません。住所や地図から選んでください。")
      return
    }

    setGpsStatus("loading")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSelectedLocation([position.coords.longitude, position.coords.latitude])
        setLocationSource("gps")
        setGpsStatus("idle")
      },
      (error) => {
        setGpsStatus("error")
        setGpsMessage(
          error.code === error.PERMISSION_DENIED
            ? "現在地の利用が許可されませんでした。住所や地図から選べます。"
            : "現在地を取得できませんでした。通信状態を確認するか、住所や地図から選んでください。",
        )
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  const t = tankenTokens
  const dialog = open ? (
    <div className="fixed inset-0 z-[80] flex min-h-0 flex-col bg-black/30" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title">
      <div className="mx-auto flex h-[100dvh] w-full max-w-2xl min-h-0 flex-col overflow-hidden" style={{ background: t.color.paper }}>
        <header className="safe-area-top flex items-center gap-3 border-b px-4 py-3" style={{ background: t.color.card, borderColor: t.border.faint }}>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold" style={{ color: t.color.primaryStrong }}>3ステップでかんたん</p>
            <h2 id="report-dialog-title" className="text-lg font-black" style={{ color: t.color.ink }}>危険を報告する</h2>
          </div>
          <button
            type="button"
            onClick={close}
            className={`grid h-11 w-11 place-items-center rounded-full border ${t.cls.focus}`}
            style={{ background: t.color.card, borderColor: t.border.soft }}
            aria-label="報告画面を閉じる"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="border-b px-4 py-3" style={{ background: t.color.sunSoft, borderColor: t.border.faint }}>
          <p className="text-sm font-black" style={{ color: t.color.ink }}>まず、ばしょを えらぼう</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={chooseCurrentLocation}
              disabled={gpsStatus === "loading"}
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-4 font-black text-white disabled:opacity-70 ${t.cls.focus}`}
              style={{ background: t.color.primary, boxShadow: t.shadow.pressGreen }}
              aria-busy={gpsStatus === "loading"}
            >
              <LocateFixed className="h-5 w-5" aria-hidden="true" />
              {gpsStatus === "loading" ? "現在地をさがしています…" : "現在地を使う"}
            </button>
            <Link
              href="/map?report=open"
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-4 font-black ${t.cls.focus}`}
              style={{ background: t.color.card, borderColor: t.border.soft, boxShadow: t.shadow.pressPaper }}
            >
              <MapPin className="h-5 w-5" aria-hidden="true" />
              住所や地図から選ぶ
            </Link>
          </div>
          {gpsStatus === "error" && (
            <p role="alert" className="mt-3 flex items-start gap-2 rounded-[14px] border px-3 py-2 text-sm font-bold" style={{ background: t.color.dangerSoft, borderColor: t.color.danger, color: t.color.danger }}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {gpsMessage}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <DangerReportForm
            onSubmit={submitReport}
            onCancel={close}
            selectedLocation={selectedLocation}
            locationSource={locationSource}
            isMobileFullscreen
          />
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <section
        className="rounded-[22px] border p-5 sm:p-7"
        style={{ background: t.color.accent, borderColor: t.color.accentStrong, boxShadow: t.shadow.card, color: "white" }}
        aria-labelledby="report-start-title"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/95" style={{ color: t.color.accentStrong }} aria-hidden="true">
            <Flag className="h-6 w-6" />
          </span>
          <div>
            <h1 id="report-start-title" className="text-2xl font-black sm:text-3xl">危険を報告する</h1>
            <p className="mt-1 text-sm font-bold text-white/90">3ステップでカンタンに報告できます</p>
          </div>
        </div>

        <ol className="mt-5 grid grid-cols-[1fr,auto,1fr,auto,1fr] items-center rounded-[18px] bg-white p-3 text-center" style={{ color: t.color.ink }} aria-label="報告の3ステップ">
          {[
            ["1", "場所"],
            ["2", "写真・内容"],
            ["3", "確認"],
          ].map(([number, label], index) => (
            <li key={number} className="contents">
              <span className="flex min-w-0 flex-col items-center gap-1 text-xs font-black sm:text-sm">
                <span className="grid h-8 w-8 place-items-center rounded-full border-2" style={{ borderColor: t.color.accent, color: t.color.accentStrong }}>{number}</span>
                {label}
              </span>
              {index < 2 && <span className="font-black" style={{ color: t.color.accent }} aria-hidden="true">→</span>}
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => {
            setSelectedLocation(null)
            setLocationSource(null)
            setOpen(true)
          }}
          className={`mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-lg font-black ${t.cls.focus}`}
          style={{ color: t.color.accentStrong, boxShadow: "0 4px 0 rgba(122,58,4,.35)" }}
        >
          <Flag className="h-5 w-5" aria-hidden="true" />
          危険を報告する
        </button>
        <button
          type="button"
          onClick={chooseCurrentLocation}
          className={`mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-white px-5 font-black text-white ${t.cls.focus}`}
        >
          <LocateFixed className="h-5 w-5" aria-hidden="true" />
          現在地からはじめる
        </button>
      </section>
      {mounted && dialog ? createPortal(dialog, document.body) : null}
    </>
  )
}
