"use client"
import dynamic from 'next/dynamic'
import { useCallback, useState } from 'react'
import TimeOfDaySlider from '@/components/3d-route/time-of-day-slider'
import AddressSearch, { GeoResult } from '@/components/3d-route/address-search'
import type { WeatherType, HazardPin } from '@/components/3d-route/cesium-viewer'
import ElevationGraph from '@/components/3d-route/elevation-graph'

const CesiumViewer = dynamic(
  () => import('@/components/3d-route/cesium-viewer'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        3Dビューを読み込み中...
      </div>
    ),
  }
)

const StreetViewPanel = dynamic(
  () => import('@/components/3d-route/street-view-panel'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        Street View を読み込み中...
      </div>
    ),
  }
)

type ViewMode = '3d' | 'street' | 'split'

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  '3d': '3D',
  split: '分割',
  street: 'Street',
}

const WEATHER_LABELS: Record<WeatherType, string> = {
  clear: '晴れ',
  rain: '雨',
  snow: '雪',
  fog: '霧',
}

type Coordinate = { lon: number, lat: number }

type RouteData = {
  id: string
  name: string
  coordinates: Coordinate[]
}

const INITIAL_MOCK_ROUTES: RouteData[] = [
  {
    id: 'route-1',
    name: '渋谷駅〜神南小学校ルート',
    coordinates: [
      { lon: 139.700588, lat: 35.658249 }, // ハチ公前
      { lon: 139.700140, lat: 35.659103 }, // スクランブル交差点
      { lon: 139.699700, lat: 35.660000 }, // センター街方面
      { lon: 139.698700, lat: 35.661000 },
      { lon: 139.699500, lat: 35.662500 }  // 神南方面
    ]
  },
  {
    id: 'route-2',
    name: '代々木公園周辺ルート',
    coordinates: [
      { lon: 139.698000, lat: 35.663000 },
      { lon: 139.696000, lat: 35.665000 },
      { lon: 139.695000, lat: 35.668000 }
    ]
  }
];

export default function ThreeDRoutePocClient() {
  const [hourOfDay, setHourOfDay] = useState(9)
  const [location, setLocation] = useState<{ lon: number; lat: number } | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('3d')

  // Enhancements State
  const [eyeHeight, setEyeHeight] = useState<number>(1.1)
  const [weather, setWeather] = useState<WeatherType>('clear')

  const [routes, setRoutes] = useState<RouteData[]>(INITIAL_MOCK_ROUTES)
  const [selectedRouteId, setSelectedRouteId] = useState<string>('')
  const [isAutoWalking, setIsAutoWalking] = useState(false)

  // Custom route creation mode
  const [isCreatingRoute, setIsCreatingRoute] = useState(false)
  const [customRouteCoords, setCustomRouteCoords] = useState<{ lon: number, lat: number }[]>([])

  const [showXRoad, setShowXRoad] = useState(false)
  const [showTraffic, setShowTraffic] = useState(false)
  const [hazards, setHazards] = useState<HazardPin[]>([
    { id: '1', lon: 139.7003, lat: 35.6588, comment: '夜間暗い' }
  ])
  const [pendingHazardCoords, setPendingHazardCoords] = useState<{ lon: number, lat: number } | null>(null)
  const [hazardComment, setHazardComment] = useState('')

  const handleSelect = (result: GeoResult) => {
    setLocation({ lon: result.lon, lat: result.lat })
  }

  const show3d = viewMode === '3d' || viewMode === 'split'
  const showStreet = viewMode === 'street' || viewMode === 'split'

  const handleMapClick = useCallback((lon: number, lat: number) => {
    if (!show3d) return;

    if (isCreatingRoute) {
      setCustomRouteCoords(prev => [...prev, { lon, lat }]);
    } else {
      setPendingHazardCoords({ lon, lat })
    }
  }, [show3d, isCreatingRoute])

  const handleSaveHazard = useCallback(() => {
    if (pendingHazardCoords && hazardComment.trim()) {
      const newHazard: HazardPin = {
        id: Date.now().toString(),
        lon: pendingHazardCoords.lon,
        lat: pendingHazardCoords.lat,
        comment: hazardComment.trim()
      }
      setHazards((prev) => [...prev, newHazard])
      setPendingHazardCoords(null)
      setHazardComment('')
    }
  }, [hazardComment, pendingHazardCoords])

  const threeDPaneClass =
    viewMode === 'split'
      ? 'w-1/2 h-full'
      : viewMode === '3d'
        ? 'w-full h-full'
        : 'w-0 h-full overflow-hidden pointer-events-none'

  const streetPaneClass =
    viewMode === 'split'
      ? 'w-1/2 h-full border-l border-white/10'
      : 'w-full h-full'

  const activeRoute = routes.find(r => r.id === selectedRouteId)
  const baseRouteCoordinates = activeRoute ? activeRoute.coordinates : []
  // Route to display: actual active selected route, OR the route currently being drawn
  const activeRouteCoordinates = isCreatingRoute ? customRouteCoords : baseRouteCoordinates

  return (
    <div className="relative w-full h-screen overflow-hidden text-sm">
      {/* メインビューポート */}
      <div className="absolute inset-0 flex">
        <div className={threeDPaneClass} aria-hidden={!show3d}>
          <CesiumViewer
            hourOfDay={hourOfDay}
            location={location}
            eyeHeight={eyeHeight}
            weather={weather}
            routeCoordinates={activeRouteCoordinates}
            isAutoWalking={isAutoWalking}
            hazards={hazards}
            onMapClick={handleMapClick}
            showXRoad={showXRoad}
            showTraffic={showTraffic}
          />
        </div>
        {showStreet && (
          <div className={streetPaneClass} aria-hidden={!showStreet}>
            <StreetViewPanel location={location} active={showStreet} />
          </div>
        )}
      </div>

      {/* 左上: 操作パネル */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 w-80 max-h-[90vh]">
        <div className="bg-black/80 backdrop-blur-md rounded-2xl px-5 py-4 border border-white/10 overflow-y-auto custom-scrollbar shadow-2xl">
          <h1 className="text-white text-base font-bold leading-tight">
            3D通学路 PoC
          </h1>
          <p className="text-slate-400 text-[11px] mt-1">
            子ども目線（110cm）で通学路の危険を体験し、データで可視化する統合プラットフォーム
          </p>

          <div className="grid grid-cols-3 gap-1 mt-4">
            {(['3d', 'split', 'street'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`text-[11px] py-1.5 rounded-lg font-medium transition-colors ${viewMode === mode
                  ? 'bg-white text-slate-900'
                  : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'
                  }`}
              >
                {VIEW_MODE_LABELS[mode]}
              </button>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-white/10">
            <AddressSearch onSelect={handleSelect} />
          </div>

          {/* セクション 1: 体験のリアリティ向上 */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
              <h2 className="text-xs text-white font-bold">1. 体験のリアリティ向上</h2>
            </div>

            <div className="mt-3">
              <label className="text-[10px] text-slate-400 block mb-1">視点の高さ</label>
              <div className="flex gap-1">
                <button
                  onClick={() => setEyeHeight(1.1)}
                  className={`flex-1 text-[11px] py-1.5 rounded-lg font-medium transition-colors ${eyeHeight === 1.1
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'
                    }`}
                >
                  子ども (110cm)
                </button>
                <button
                  onClick={() => setEyeHeight(1.6)}
                  className={`flex-1 text-[11px] py-1.5 rounded-lg font-medium transition-colors ${eyeHeight === 1.6
                    ? 'bg-slate-600 text-white'
                    : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'
                    }`}
                >
                  大人 (160cm)
                </button>
              </div>
            </div>

            <div className="mt-3">
              <label className="text-[10px] text-slate-400 block mb-1">天候・視界</label>
              <div className="grid grid-cols-4 gap-1">
                {(['clear', 'rain', 'snow', 'fog'] as WeatherType[]).map((w) => (
                  <button
                    key={w}
                    onClick={() => setWeather(w)}
                    className={`text-[11px] py-1.5 rounded-lg font-medium transition-colors ${weather === w
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'
                      }`}
                  >
                    {WEATHER_LABELS[w]}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
              大人の目線からは見えるブロック塀の死角を比較し、夕暮れや雨天時の見通しの悪さをシミュレーションします。
            </p>
          </div>

          {/* セクション 2: データとの重畳・連携 */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-4 bg-orange-500 rounded-full"></div>
              <h2 className="text-xs text-white font-bold">2. データとの重畳・連携</h2>
            </div>

            <div className="flex items-center justify-between mt-3 bg-white/5 p-2 rounded-lg border border-white/5">
              <div>
                <span className="text-xs text-white flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  xROAD データ連携
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">歩道未整備区間などのオープンデータ</p>
              </div>
              <button
                onClick={() => setShowXRoad(!showXRoad)}
                className={`w-10 h-5 rounded-full relative transition-colors ${showXRoad ? 'bg-orange-500' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${showXRoad ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </button>
            </div>

            {/* トラフィック トグル */}
            <div className="flex items-center justify-between mt-2 bg-white/5 p-2 rounded-lg border border-white/5">
              <div>
                <span className="text-xs text-white flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  交通量シミュレーション
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">交通量や大型車の近接・圧迫感を再現</p>
              </div>
              <button
                onClick={() => setShowTraffic(!showTraffic)}
                className={`w-10 h-5 rounded-full relative transition-colors ${showTraffic ? 'bg-blue-500' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${showTraffic ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </button>
            </div>

            <div className="mt-3 p-2 border border-dashed border-red-500/30 rounded-lg bg-red-500/5">
              <span className="text-xs text-white flex items-center gap-1 mb-1">
                <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                ハザードピン留め機能
              </span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                3Dマップ上の任意の地点をクリックして、危険箇所（ハザード）を報告・共有できます。
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {hazards.map(h => (
                  <span key={h.id} className="text-[9px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded border border-red-500/20">
                    {h.comment}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* セクション 3: 機能の実用化 */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
              <h2 className="text-xs text-white font-bold">3. 機能の実用化</h2>
            </div>

            <div className="mt-3">
              <label className="text-[10px] text-slate-400 block mb-1">保存済みルートの選択</label>
              <select
                value={selectedRouteId}
                onChange={(e) => {
                  setSelectedRouteId(e.target.value)
                  setIsAutoWalking(false)
                  if (isCreatingRoute) {
                    setIsCreatingRoute(false)
                    setCustomRouteCoords([])
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-[11px] rounded-lg px-3 py-2 text-left focus:outline-none focus:border-blue-500 appearance-none"
              >
                <option value="">（ルート非表示）</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>

              <div className="mt-2 text-right">
                {!isCreatingRoute ? (
                  <button
                    onClick={() => {
                      setIsCreatingRoute(true)
                      setSelectedRouteId('')
                      setIsAutoWalking(false)
                      setCustomRouteCoords([])
                    }}
                    className="text-[10px] text-blue-400 hover:text-blue-300 underline"
                  >
                    + 新しいルートを作成する
                  </button>
                ) : (
                  <div className="bg-blue-900/30 border border-blue-500/50 p-2 rounded flex flex-col gap-2 relative">
                    {/* Pulse indicator for creation mode */}
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>

                    <p className="text-[10px] text-blue-200 text-left mb-1">
                      マップ上をクリックして経由地を追加してください。<br />
                      現在 {customRouteCoords.length} 点
                    </p>

                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setCustomRouteCoords([])
                          setIsCreatingRoute(false)
                        }}
                        className="flex-1 py-1.5 rounded text-[10px] bg-slate-800 text-slate-300 hover:bg-slate-700"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={() => setCustomRouteCoords([])}
                        disabled={customRouteCoords.length === 0}
                        className="flex-1 py-1.5 rounded text-[10px] border border-slate-600 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                      >
                        クリア
                      </button>
                      <button
                        onClick={() => {
                          if (customRouteCoords.length < 2) return;
                          const newRoute: RouteData = {
                            id: `custom-route-${Date.now()}`,
                            name: `作成ルート (${customRouteCoords.length}点)`,
                            coordinates: [...customRouteCoords]
                          };
                          setRoutes([...routes, newRoute]);
                          setSelectedRouteId(newRoute.id);
                          setIsCreatingRoute(false);
                          setCustomRouteCoords([]);
                        }}
                        disabled={customRouteCoords.length < 2}
                        className="flex-1 py-1.5 rounded text-[10px] bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {selectedRouteId && !isCreatingRoute && (
                <div className="mt-3">
                  <button
                    onClick={() => setIsAutoWalking(!isAutoWalking)}
                    className={`w-full flex items-center justify-center gap-2 text-[11px] py-2 rounded-lg font-bold transition-all ${isAutoWalking
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50'
                      : 'bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-900/20'
                      }`}
                  >
                    {isAutoWalking ? 'ウォークスルー停止' : 'ルートを自動歩行'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hazard Pin Input Modal */}
      {pendingHazardCoords && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-900 border border-white/20 p-4 rounded-xl shadow-2xl w-64">
          <h3 className="text-white text-sm font-bold mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            危険箇所を報告
          </h3>
          <p className="text-[10px] text-slate-400 mb-3">
            lon: {pendingHazardCoords.lon.toFixed(4)}, lat: {pendingHazardCoords.lat.toFixed(4)}
          </p>
          <input
            type="text"
            placeholder="例: 見通しが悪い、街灯がない"
            value={hazardComment}
            onChange={(e) => setHazardComment(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded text-sm text-white px-2 py-1.5 focus:outline-none focus:border-blue-500 mb-3"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => setPendingHazardCoords(null)}
              className="flex-1 py-1.5 rounded text-xs text-slate-300 hover:bg-white/10"
            >
              キャンセル
            </button>
            <button
              onClick={handleSaveHazard}
              disabled={!hazardComment.trim()}
              className="flex-1 py-1.5 rounded text-xs bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
            >
              ピン留め
            </button>
          </div>
        </div>
      )}

      {/* 下部: 標高グラフ & 時間帯スライダー */}
      {show3d && (
        <div
          className={`absolute bottom-8 z-10 w-[500px] flex flex-col gap-2 ${viewMode === 'split'
            ? 'left-1/4 -translate-x-1/2'
            : 'left-1/2 -translate-x-1/2'
            }`}
        >
          {/* 標高グラフ（ルート選択時のみ表示） */}
          {activeRouteCoordinates.length > 0 && (
            <ElevationGraph routeCoordinates={activeRouteCoordinates} />
          )}

          {/* 時間帯スライダー */}
          <div className="bg-black/80 backdrop-blur-md rounded-xl p-3 px-4 border border-white/10 shadow-lg">
            <label className="text-xs font-medium text-white block mb-1 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              時間帯シミュレーション
            </label>
            <p className="text-[10px] text-slate-400 mb-2">帰宅時間帯（夕方や夜間）の西日、影の長さ、暗さを確認できます。</p>
            <TimeOfDaySlider value={hourOfDay} onChange={setHourOfDay} />
          </div>
        </div>
      )}
    </div>
  )
}
