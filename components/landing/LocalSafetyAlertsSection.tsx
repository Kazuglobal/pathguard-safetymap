"use client"

import * as React from "react"
import { AlertCircle, MapPin, Clock, ExternalLink, Leaf, Sparkles } from "lucide-react"
import {
  useLocalSafetyAlerts,
  formatRelativeTime,
  isBreakingAlert,
  type LocalAlertCategory,
} from "@/hooks/use-local-safety-alerts"
import { getActionPhraseForAlert } from "@/lib/local-alert-action-phrases"
import { ALL_PREFECTURES } from "@/lib/user-region"
import { useAlertSchoolDistrict } from "@/hooks/use-alert-school-district"
import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

// --- 定数 ---

const CATEGORY_CONFIG: Record<LocalAlertCategory, { label: string; color: string }> = {
  suspicious: { label: "不審者情報", color: "#D8660A" },
  voice_call: { label: "声かけ事案", color: "#D95555" },
  following:  { label: "つきまとい",  color: "#C03A3A" },
  other:      { label: "その他",     color: "#847661" },
}

// --- コンポーネント ---

export function LocalSafetyAlertsSection() {
  const selection = useAlertSchoolDistrict()
  const enabled = selection.mounted && Boolean(selection.district) && !selection.error
  const { alerts, isLoading, error } = useLocalSafetyAlerts({
    prefecture: selection.prefecture,
    schoolDistrictId: selection.district?.id,
    enabled,
    limitHours: 24,
  })
  const areaLabel = selection.district ? `${selection.city} ${selection.district.name}の学区` : ''
  const selectClass = `w-full rounded-xl border bg-white px-3 py-2 text-sm disabled:opacity-50 ${tankenTokens.cls.focus}`

  return (
    <section className="py-6 md:py-10" style={{ background: C.accentSoft }}>
      <div className="mx-auto max-w-6xl">
        {/* セクションヘッダー */}
        <div className="mb-4 flex flex-col items-start gap-2 px-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 animate-pulse rounded-full"
              style={{ background: C.accent }}
            />
            <h2 className="text-lg font-black md:text-xl" style={{ color: C.ink }}>
              今日の地域アラート
            </h2>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-bold"
              style={{ background: "rgba(244,128,31,.15)", color: C.accentStrong }}
            >
              リアルタイム
            </span>
          </div>
          <p className="px-0.5 text-xs" style={{ color: C.inkFaint }}>
            3時間毎に収集・5分毎に自動更新
          </p>
        </div>

        <div className="mb-4 px-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold" style={{ color: C.inkSoft }}>
              都道府県
              <select className={`${selectClass} mt-1`} value={selection.prefecture} disabled={!selection.mounted} onChange={event => selection.changePrefecture(event.target.value)}>
                <option value="">都道府県を選択</option>
                {ALL_PREFECTURES.map(pref => <option key={pref} value={pref}>{pref}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold" style={{ color: C.inkSoft }}>
              市区町村
              <select className={`${selectClass} mt-1`} value={selection.city ?? ''} disabled={!selection.prefecture || selection.isLoading || Boolean(selection.error)} onChange={event => selection.changeCity(event.target.value)}>
                <option value="">市区町村を選択</option>
                {selection.cities.map(city => <option key={city} value={city}>{city}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold" style={{ color: C.inkSoft }}>
              小学校区
              <select className={`${selectClass} mt-1`} value={selection.districtId} disabled={!selection.city || selection.isLoading || Boolean(selection.error)} onChange={event => selection.changeDistrict(event.target.value)}>
                <option value="">小学校区を選択</option>
                {selection.districts.map(district => <option key={district.id} value={district.id}>{district.name}</option>)}
              </select>
            </label>
          </div>
          {selection.district && <p className="mt-2 text-xs" style={{ color: C.inkSoft }}>
            {areaLabel} · {selection.district.dataYear}年度の通学区域データ
            {' · '}<a href={selection.district.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">学区データの出典（加工して利用）</a>
            <span className="mt-1 block">通学区域は変更される場合があります。最新の区域は自治体にご確認ください。</span>
          </p>}
        </div>

        {/* アラートリスト */}
        <div className="px-4">
          {selection.isLoading && <p role="status" className="mb-3 text-sm">学区情報を読み込んでいます…</p>}
          {selection.error && <div role="alert" className="mb-3 rounded-xl border bg-white p-4 text-sm">
            学区情報の読み込みに失敗しました。
            <button className={`ml-2 underline ${tankenTokens.cls.focus}`} onClick={selection.retry}>再試行</button>
          </div>}
          {!selection.isLoading && !selection.error && selection.unsupported && <p role="status" className="rounded-xl border bg-white p-4 text-sm">この地域の小学校区データは現在未対応です。</p>}
          {!enabled && !selection.isLoading && !selection.error && !selection.unsupported && <p className="rounded-xl border bg-white p-4 text-sm">地域と小学校区を選ぶと、この地域の最新情報を確認できます。</p>}
          {enabled && isLoading && (
            <div
              className="flex min-h-[88px] animate-pulse items-center justify-center rounded-[18px] border p-6 text-sm"
              style={{ background: C.card, borderColor: tankenTokens.border.faint, color: C.inkFaint }}
            >
              確認しています…
            </div>
          )}

          {enabled && error && (
            <div
              className="rounded-[18px] border p-4 text-sm"
              style={{ background: C.card, borderColor: "rgba(217,85,85,.4)", color: C.danger }}
            >
              アラートの取得に失敗しました。時間をおいて再読み込みしてください。
            </div>
          )}

          {enabled && !isLoading && !error && alerts.length === 0 && (
            <div
              className="flex min-h-[88px] items-center justify-center gap-3 rounded-[18px] border p-6"
              style={{ background: C.card, borderColor: tankenTokens.border.faint }}
            >
              <span
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: C.primarySoft }}
              >
                <Leaf className="h-5 w-5" style={{ color: C.primaryStrong }} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: C.ink }}>
                  {areaLabel}では、この24時間の新しいアラートは確認されていません
                </p>
                <p className="mt-0.5 text-xs" style={{ color: C.inkSoft }}>
                  取得した情報のうち、発生場所を学区内と確認できたものを表示しています。
                </p>
              </div>
            </div>
          )}

          {enabled && !error && alerts.length > 0 && (
            <div
              className="divide-y overflow-hidden rounded-[18px] border"
              style={{
                background: C.card,
                borderColor: tankenTokens.border.faint,
                boxShadow: tankenTokens.shadow.soft,
              }}
            >
              {alerts.map((alert) => {
                const config = CATEGORY_CONFIG[alert.category] ?? CATEGORY_CONFIG['other']
                const breaking = isBreakingAlert(alert.occurred_at)

                return (
                  <div
                    key={alert.id}
                    className="flex gap-3 p-3 md:p-4"
                    style={breaking ? { background: C.accentSoft } : undefined}
                  >
                    {/* カテゴリアイコン */}
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${config.color}20` }}
                    >
                      <AlertCircle
                        className="h-5 w-5"
                        style={{ color: config.color }}
                        aria-hidden="true"
                      />
                    </div>

                    {/* コンテンツ */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                          style={{ backgroundColor: config.color }}
                        >
                          {config.label}
                        </span>
                        {breaking && (
                          <span
                            className="inline-flex animate-pulse items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                            style={{ background: C.danger }}
                          >
                            <span className="h-1 w-1 rounded-full bg-white" />
                            新着
                          </span>
                        )}
                        <span className="flex items-center gap-0.5 text-[10px]" style={{ color: C.inkFaint }}>
                          <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                          {formatRelativeTime(alert.occurred_at)}
                        </span>
                      </div>

                      <p className="line-clamp-3 text-sm leading-snug" style={{ color: C.ink }}>
                        {alert.description}
                      </p>

                      {/* そなえの一言（恐怖で終わらせない原則） */}
                      <p
                        className="mt-1.5 flex items-start gap-1 rounded-[10px] px-2 py-1.5 text-xs leading-snug"
                        style={{ background: C.primarySoft, color: C.primaryStrong }}
                      >
                        <Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
                        <span>
                          <span className="font-bold">そなえ: </span>
                          {getActionPhraseForAlert(alert.id, alert.category)}
                        </span>
                      </p>

                      <div className="mt-1 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs" style={{ color: C.inkSoft }}>
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          {alert.prefecture}
                          {alert.city && ` ${alert.city}`}
                        </span>
                        {alert.source_url?.startsWith('https://') && (
                          <a
                            href={alert.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-0.5 rounded text-[10px] font-bold hover:underline ${tankenTokens.cls.focus}`}
                            style={{ color: C.sky }}
                          >
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            ソース
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
