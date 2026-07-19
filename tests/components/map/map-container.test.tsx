/**
 * MapContainer characterization tests
 *
 * map-container.tsx の分割リファクタリングの安全網。
 * 子コンポーネントは props キャプチャ型のスタブ、mapbox-gl はイベント発火可能な
 * フェイクに差し替え、「どの状態でどの props が子に流れるか」「地図イベントで
 * どう状態遷移するか」という配線そのものを固定する。
 *
 * 注意: ここでは新しく抽出した hooks はモックしない（コンテナ経由で実体を検証する）。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import MapContainer from '@/components/map/map-container'

// ---- 共有ホルダー（vi.mock ファクトリから参照するため hoisted） ----
const h = vi.hoisted(() => {
  class FakeMarker {
    element: HTMLElement | undefined
    draggable: boolean
    lngLat: [number, number] | null = null
    handlers: Record<string, Array<() => void>> = {}
    remove = vi.fn()
    constructor(options?: HTMLElement | { element?: HTMLElement; draggable?: boolean }) {
      if (options instanceof HTMLElement) {
        this.element = options
        this.draggable = false
      } else {
        this.element = options?.element
        this.draggable = options?.draggable ?? false
      }
    }
    setLngLat(coords: [number, number]) {
      this.lngLat = coords
      return this
    }
    addTo() {
      return this
    }
    on(event: string, cb: () => void) {
      ;(this.handlers[event] ??= []).push(cb)
      return this
    }
    getLngLat() {
      return { lng: this.lngLat?.[0] ?? 0, lat: this.lngLat?.[1] ?? 0 }
    }
  }

  class FakePopup {
    remove = vi.fn()
    setLngLat() {
      return this
    }
    setDOMContent() {
      return this
    }
    addTo() {
      return this
    }
  }

  class FakeLngLatBounds {
    coords: Array<[number, number]> = []
    extend(coord: [number, number]) {
      this.coords.push(coord)
      return this
    }
    isEmpty() {
      return this.coords.length === 0
    }
  }

  class FakeMap {
    handlers: Record<string, Array<(e: unknown) => void>> = {}
    onceHandlers: Record<string, Array<(e: unknown) => void>> = {}
    layers = new Map<string, unknown>()
    sources = new Map<string, unknown>()
    controls: unknown[] = []
    isLoaded = false
    terrain: unknown = undefined
    styleUrl: string
    canvasStyle: Record<string, string> = {}

    on = vi.fn((event: string, cb: (e: unknown) => void) => {
      ;(this.handlers[event] ??= []).push(cb)
      return this
    })
    once = vi.fn((event: string, cb: (e: unknown) => void) => {
      ;(this.onceHandlers[event] ??= []).push(cb)
      return this
    })
    off = vi.fn((event: string, cb: (e: unknown) => void) => {
      this.handlers[event] = (this.handlers[event] ?? []).filter((fn) => fn !== cb)
      return this
    })
    fire(event: string, payload?: unknown) {
      if (event === 'load') this.isLoaded = true
      this.handlers[event]?.slice().forEach((cb) => cb(payload))
      const once = this.onceHandlers[event] ?? []
      this.onceHandlers[event] = []
      once.forEach((cb) => cb(payload))
    }

    loaded = vi.fn(() => this.isLoaded)
    remove = vi.fn()
    getCenter = vi.fn(() => ({ lng: 139.6917, lat: 35.6895 }))
    getCanvas = vi.fn(() => ({ style: this.canvasStyle }))
    getBounds = vi.fn(() => ({
      getWest: () => 139,
      getSouth: () => 35,
      getEast: () => 140,
      getNorth: () => 36,
    }))
    flyTo = vi.fn()
    fitBounds = vi.fn()
    easeTo = vi.fn()
    getZoom = vi.fn(() => this.options?.zoom ?? 15)
    setStyle = vi.fn((style: string) => {
      this.styleUrl = style
    })
    setTerrain = vi.fn((config: unknown) => {
      this.terrain = config
    })
    setPitch = vi.fn()
    setBearing = vi.fn()
    getLayer = vi.fn((id: string) => this.layers.get(id))
    getSource = vi.fn((id: string) => this.sources.get(id))
    addLayer = vi.fn((config: { id: string }) => {
      this.layers.set(config.id, config)
    })
    removeLayer = vi.fn((id: string) => {
      this.layers.delete(id)
    })
    addSource = vi.fn((id: string, config: unknown) => {
      this.sources.set(id, config)
    })
    removeSource = vi.fn((id: string) => {
      this.sources.delete(id)
    })
    hasControl = vi.fn((control: unknown) => this.controls.includes(control))
    addControl = vi.fn((control: unknown) => {
      this.controls.push(control)
    })
    removeControl = vi.fn((control: unknown) => {
      this.controls = this.controls.filter((c) => c !== control)
    })

    options: { style: string; center?: [number, number]; zoom?: number }

    constructor(options: { style: string; center?: [number, number]; zoom?: number }) {
      this.styleUrl = options.style
      this.options = options
      holder.maps.push(this)
    }
  }

  const holder = {
    FakeMap,
    FakeMarker,
    FakePopup,
    FakeLngLatBounds,
    maps: [] as InstanceType<typeof FakeMap>[],
    markers: [] as InstanceType<typeof FakeMarker>[],
    captured: {} as Record<string, any>,
    toast: vi.fn(),
    isMobile: false,
    searchParams: new URLSearchParams(),
    gps: {
      location: null as [number, number] | null,
      isLoading: false,
      requestLocation: vi.fn(),
      reset: vi.fn(),
    },
    userRoutes: {
      routes: [] as any[],
      primaryRoute: null as any,
    },
    reports: {
      dangerReports: [] as any[],
      pendingReports: [] as any[],
      setDangerReports: vi.fn(),
      setPendingReports: vi.fn(),
    },
    admin: { isAdmin: false, currentUserId: null as string | null },
    fetchStats: vi.fn(),
    resetStats: vi.fn(),
    reportSubmit: vi.fn(async () => ({ reportId: 'new-report-1' })),
    supabase: null as any,
  }
  return holder
})

// ---- mapbox-gl ----
vi.mock('mapbox-gl', () => ({
  default: {
    accessToken: '',
    supported: () => true,
    Map: h.FakeMap,
    Marker: class extends h.FakeMarker {
      constructor(options?: any) {
        super(options)
        h.markers.push(this)
      }
    },
    Popup: h.FakePopup,
    LngLatBounds: h.FakeLngLatBounds,
    NavigationControl: class {},
    GeolocateControl: class {},
  },
}))

vi.mock('@/lib/mapbox-config', () => ({
  getMapboxToken: () => 'test-token',
  validateMapboxToken: () => ({ isValid: true }),
}))

vi.mock('@/lib/hunter/map-labels', () => ({
  localizeMapLabels: vi.fn(),
}))

// ---- プロバイダ / ルーティング ----
vi.mock('@/components/providers/supabase-provider', () => ({
  useSupabase: () => ({ supabase: h.supabase }),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => h.searchParams,
}))

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: h.toast }),
}))

vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: () => h.isMobile,
}))

// ---- データ系フック ----
vi.mock('@/hooks/use-danger-reports', () => ({
  useDangerReports: () => h.reports,
}))

vi.mock('@/hooks/use-admin-status', () => ({
  useAdminStatus: () => h.admin,
}))

vi.mock('@/hooks/use-user-routes', () => ({
  useUserRoutes: () => h.userRoutes,
}))

vi.mock('@/hooks/use-current-location', () => ({
  useCurrentLocation: () => h.gps,
}))

vi.mock('@/hooks/use-accident-heatmap', () => ({
  useAccidentHeatmap: () => ({
    isVisible: false,
    toggleVisibility: vi.fn(),
    filters: {},
    setFilters: vi.fn(),
    isLoading: false,
    featureCount: 0,
    error: null,
    geoJSON: null,
    fetchForViewport: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-accident-stats', () => ({
  useAccidentStats: () => ({
    stats: null,
    status: 'idle',
    fetchStats: h.fetchStats,
    reset: h.resetStats,
  }),
}))

vi.mock('@/hooks/use-route-dangers', () => ({
  useRouteDangers: () => ({ dangers: [], isLoading: false }),
}))

vi.mock('@/hooks/use-map-image-overlays', () => ({
  useMapImageOverlays: () => ({
    setMapImageOverlays: vi.fn(),
    previewImage: null,
    setPreviewImage: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-danger-markers', () => ({
  useDangerMarkers: () => undefined,
}))

vi.mock('@/hooks/use-danger-report-submit', () => ({
  useDangerReportSubmit: () => h.reportSubmit,
}))

// ---- 子コンポーネント（props キャプチャ型スタブ） ----
vi.mock('@/components/map/map-floating-controls', () => ({
  default: (props: any) => {
    h.captured.floatingControls = props
    return <div data-testid="floating-controls" />
  },
}))

vi.mock('@/components/map/map-sidebar', () => ({
  default: (props: any) => {
    h.captured.sidebar = props
    return <div data-testid="map-sidebar" />
  },
}))

vi.mock('@/components/map/map-top-overlay', () => ({
  // スロット props の中身（ハザードパネル等）も検証対象なので、スロットは実際に描画する
  default: (props: any) => {
    h.captured.topOverlay = props
    return (
      <div data-testid="map-top-overlay">
        {props.searchSlot}
        {props.threeDPanelSlot}
        {props.arPanelSlot}
        {props.heatmapPanelSlot}
        {props.hazardPanelSlot}
        {props.suspiciousPanelSlot}
      </div>
    )
  },
}))

vi.mock('@/components/map/map-search', () => ({
  default: (props: any) => {
    h.captured.mapSearch = props
    return <div data-testid="map-search" />
  },
}))

vi.mock('@/components/map/map-3d-toggle', () => ({
  default: (props: any) => {
    h.captured.map3dToggle = props
    return <div data-testid="map-3d-toggle" />
  },
}))

vi.mock('@/components/map/accident-stats-overlay', () => ({
  AccidentStatsOverlay: (props: any) => {
    h.captured.accidentStatsOverlay = props
    return <div data-testid="accident-stats-overlay" />
  },
}))

vi.mock('@/components/map/accident-heatmap-layer', () => ({
  AccidentHeatmapLayer: () => null,
}))

vi.mock('@/components/map/accident-heatmap-controls', () => ({
  AccidentHeatmapControls: () => <div data-testid="heatmap-controls" />,
}))

vi.mock('@/components/map/route-hazard-panel', () => ({
  RouteHazardPanel: (props: any) => {
    h.captured.routeHazardPanel = props
    return <div data-testid="route-hazard-panel" />
  },
}))

vi.mock('@/components/map/hazard-image-modal', () => ({
  HazardImageModal: (props: any) => {
    h.captured.hazardImageModal = props
    return null
  },
}))

vi.mock('@/components/map/map-report-forms', () => ({
  MapReportForms: (props: any) => {
    h.captured.reportForms = props
    return <div data-testid="map-report-forms" />
  },
}))

vi.mock('@/components/map/mobile-location-sheet', () => ({
  MobileLocationSheet: (props: any) => {
    h.captured.mobileLocationSheet = props
    return <div data-testid="mobile-location-sheet" />
  },
}))

vi.mock('@/components/map/map-status-overlays', () => ({
  MapStatusOverlays: (props: any) => {
    h.captured.statusOverlays = props
    return <div data-testid="map-status-overlays" />
  },
}))

vi.mock('@/components/map/suspicious-alert-layer', () => ({
  SuspiciousAlertLayer: (props: any) => {
    h.captured.suspiciousLayer = props
    return null
  },
}))

vi.mock('@/components/danger-report/suspicious-alert-form', () => ({
  default: (props: any) => {
    h.captured.suspiciousForm = props
    return <div data-testid="suspicious-alert-form" />
  },
}))

vi.mock('@/components/danger-report/image-preview-dialog', () => ({
  default: () => null,
}))

vi.mock('@/components/danger-report/danger-report-detail-modal', () => ({
  default: (props: any) => {
    h.captured.detailModal = props
    return null
  },
}))

vi.mock('@/components/danger-report/submitted-report-preview', () => ({
  default: (props: any) => {
    h.captured.submittedPreview = props
    return null
  },
}))

vi.mock('@/components/map/ar-view', () => ({
  default: (props: any) => {
    h.captured.arView = props
    return <div data-testid="ar-view" />
  },
}))

// ---- ヘルパー ----

function createSupabaseMock() {
  const eq = vi.fn(async () => ({ error: null }))
  const del = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ delete: del }))
  const storageRemove = vi.fn(async () => ({ error: null }))
  const storageFrom = vi.fn(() => ({ remove: storageRemove }))
  return {
    from,
    storage: { from: storageFrom },
    _spies: { from, del, eq, storageFrom, storageRemove },
  }
}

function lastMap() {
  const map = h.maps.at(-1)
  if (!map) throw new Error('Map was not initialized')
  return map
}

function renderMapContainer(props?: {
  autoOpenReport?: boolean
  preferredRouteId?: string | null
  initialReportId?: string | null
}) {
  const utils = render(<MapContainer {...props} />)
  return utils
}

function fireMapLoad() {
  act(() => {
    lastMap().fire('load')
  })
}

function fireMapClick(lng = 139.7, lat = 35.68) {
  act(() => {
    lastMap().fire('click', { lngLat: { lng, lat } })
  })
}

const sampleReport = (overrides: Record<string, unknown> = {}) => ({
  id: 'report-1',
  title: 'テスト報告',
  user_id: 'user-1',
  status: 'pending',
  danger_type: 'traffic',
  danger_level: 3,
  latitude: 35.68,
  longitude: 139.7,
  image_url: null,
  processed_image_urls: [],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  h.maps.length = 0
  h.markers.length = 0
  h.captured = {}
  h.isMobile = false
  h.searchParams = new URLSearchParams()
  h.gps.location = null
  h.gps.isLoading = false
  h.userRoutes.routes = []
  h.userRoutes.primaryRoute = null
  h.reports.dangerReports = []
  h.reports.pendingReports = []
  h.admin.isAdmin = false
  h.admin.currentUserId = null
  h.supabase = createSupabaseMock()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ markers: [] }) })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('MapContainer characterization', () => {
  describe('報告ディープリンク', () => {
    it('一覧に含まれない本人の報告もID指定で取得して詳細を開く', async () => {
      const rejectedReport = sampleReport({ id: 'rejected-1', status: 'rejected' })
      const maybeSingle = vi.fn(async () => ({ data: rejectedReport, error: null }))
      const eq = vi.fn(() => ({ maybeSingle }))
      const select = vi.fn(() => ({ eq }))
      const from = vi.fn(() => ({ select }))
      h.supabase = { from }

      renderMapContainer({ initialReportId: 'rejected-1' })

      await waitFor(() => {
        expect(h.captured.detailModal).toEqual(
          expect.objectContaining({ isOpen: true, report: rejectedReport }),
        )
      })
      expect(from).toHaveBeenCalledWith('danger_reports')
      expect(eq).toHaveBeenCalledWith('id', 'rejected-1')
    })
  })

  describe('初期化とローディング', () => {
    it('マウント時はローディング中で、map の load イベントで解除される', () => {
      renderMapContainer()
      expect(h.captured.statusOverlays.isLoading).toBe(true)

      fireMapLoad()

      expect(h.captured.statusOverlays.isLoading).toBe(false)
      // クリックリスナーが一度だけ登録されている
      const clickHandlers = lastMap().handlers['click'] ?? []
      expect(clickHandlers).toHaveLength(1)
    })

    it('デスクトップでは load 後に NavigationControl が追加される', () => {
      renderMapContainer()
      fireMapLoad()
      // NavigationControl + GeolocateControl の2つ
      expect(lastMap().controls.length).toBe(2)
    })
  })

  describe('初期表示センター', () => {
    it('登録ルート（primaryRoute）があれば初期 center がルート中心になる', () => {
      const route = {
        id: 'route-a',
        name: 'ルートA',
        start_lat: 35.0,
        start_lng: 139.0,
        end_lat: 35.2,
        end_lng: 139.2,
        is_favorite: true,
        created_at: '2026-01-01T00:00:00Z',
      }
      h.userRoutes.routes = [route]
      h.userRoutes.primaryRoute = route

      renderMapContainer()

      expect(lastMap().options.center?.[0]).toBeCloseTo(139.1, 6)
      expect(lastMap().options.center?.[1]).toBeCloseTo(35.1, 6)
      // 東京固定ではない
      expect(lastMap().options.center).not.toEqual([139.6917, 35.6895])
    })

    it('ルートなし・現在地取得済みなら現在地中心で初期化される', () => {
      h.gps.location = [140.5, 36.5]

      renderMapContainer()

      expect(lastMap().options.center).toEqual([140.5, 36.5])
      expect(lastMap().options.zoom).toBe(15)
    })

    it('ルートなし・現在地なしなら東京フォールバックで初期化し、現在地を要求する', () => {
      renderMapContainer()

      expect(lastMap().options.center).toEqual([139.6917, 35.6895])
      expect(lastMap().options.zoom).toBe(12)
      expect(h.gps.requestLocation).toHaveBeenCalled()
    })
  })

  describe('地図クリックの分岐', () => {
    it('通常クリック（デスクトップ）: 事故統計を取得し、サイドバーは開かない', () => {
      renderMapContainer()
      fireMapLoad()

      fireMapClick(139.7, 35.68)

      expect(h.fetchStats).toHaveBeenCalledWith({
        latitude: 35.68,
        longitude: 139.7,
        radiusMeters: 300,
        years: 5,
      })
      expect(document.querySelector('.bg-black\\/50')).toBeNull()
    })

    it('通常クリック（モバイル）: サイドバーが開く', () => {
      h.isMobile = true
      renderMapContainer()
      fireMapLoad()

      fireMapClick()

      expect(h.fetchStats).toHaveBeenCalled()
      // サイドバーオーバーレイが表示される
      expect(document.querySelector('.bg-black\\/50')).not.toBeNull()
    })

    it('地点選択モード中（モバイル）: 位置を設定するがフォームは開かない', () => {
      h.isMobile = true
      renderMapContainer()
      fireMapLoad()

      act(() => {
        h.captured.floatingControls.onAddReport()
      })
      expect(h.captured.mobileLocationSheet.awaitingLocationSelection).toBe(true)

      fireMapClick(139.75, 35.7)

      expect(h.captured.mobileLocationSheet.selectedLocation).toEqual([139.75, 35.7])
      expect(h.captured.reportForms.isReportFormOpen).toBe(false)
      expect(h.fetchStats).not.toHaveBeenCalled()
    })

    it('フォーム表示中のクリック: 位置を更新してトーストを出す', () => {
      renderMapContainer()
      fireMapLoad()

      act(() => {
        h.captured.floatingControls.onAddReport()
      })
      expect(h.captured.reportForms.isReportFormOpen).toBe(true)

      fireMapClick(139.8, 35.6)

      expect(h.captured.reportForms.selectedLocation).toEqual([139.8, 35.6])
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '地点を変更しました' }),
      )
    })
  })

  describe('報告フロー', () => {
    it('報告ボタン（デスクトップ）: フォームが開き、地図中心が初期地点になる', () => {
      renderMapContainer()
      fireMapLoad()

      act(() => {
        h.captured.floatingControls.onAddReport()
      })

      expect(h.captured.reportForms.isReportFormOpen).toBe(true)
      expect(h.captured.reportForms.selectedLocation).toEqual([139.6917, 35.6895])
      expect(h.captured.reportForms.locationSource).toBe('manual')
    })

    it('報告ボタン（モバイル）: 地点選択モードをトグルする', () => {
      h.isMobile = true
      renderMapContainer()
      fireMapLoad()

      act(() => {
        h.captured.floatingControls.onAddReport()
      })
      expect(h.captured.mobileLocationSheet.awaitingLocationSelection).toBe(true)
      expect(h.captured.reportForms.isReportFormOpen).toBe(false)

      act(() => {
        h.captured.floatingControls.onAddReport()
      })
      expect(h.captured.mobileLocationSheet.awaitingLocationSelection).toBe(false)
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '地点選択をキャンセルしました' }),
      )
    })

    it('autoOpenReport: デスクトップはフォーム、モバイルは地点選択モードが開く', () => {
      renderMapContainer({ autoOpenReport: true })
      fireMapLoad()
      expect(h.captured.reportForms.isReportFormOpen).toBe(true)
    })

    it('autoOpenReport（モバイル）: 地点選択モードが開く', () => {
      h.isMobile = true
      renderMapContainer({ autoOpenReport: true })
      fireMapLoad()
      expect(h.captured.mobileLocationSheet.awaitingLocationSelection).toBe(true)
      expect(h.captured.reportForms.isReportFormOpen).toBe(false)
    })
  })

  describe('GPS 現在地で報告', () => {
    it('有効な GPS 位置が取れたらフォームを開き、地図を移動する', () => {
      h.gps.location = [139.71, 35.66]
      renderMapContainer()
      fireMapLoad()

      expect(h.captured.reportForms.isReportFormOpen).toBe(true)
      expect(h.captured.reportForms.selectedLocation).toEqual([139.71, 35.66])
      expect(h.captured.reportForms.locationSource).toBe('gps')
      expect(lastMap().flyTo).toHaveBeenCalledWith(
        expect.objectContaining({ center: [139.71, 35.66], zoom: 16 }),
      )
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '現在地を候補として設定しました' }),
      )
    })

    it('不正な GPS 座標はエラートーストを出してフォームを開かない', () => {
      h.gps.location = [NaN, NaN]
      renderMapContainer()
      fireMapLoad()

      expect(h.captured.reportForms.isReportFormOpen).toBe(false)
      expect(h.gps.reset).toHaveBeenCalled()
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '位置情報エラー', variant: 'destructive' }),
      )
    })
  })

  describe('不審者アラート', () => {
    it('?suspiciousAlert=1 で専用フォームが開く', () => {
      h.searchParams = new URLSearchParams('suspiciousAlert=1')
      renderMapContainer()
      fireMapLoad()
      expect(h.captured.suspiciousForm).toBeDefined()
    })

    it('フォーム表示中のクリックは地点指定になり、事故統計は取得しない', () => {
      h.searchParams = new URLSearchParams('suspiciousAlert=1')
      renderMapContainer()
      fireMapLoad()

      fireMapClick(139.72, 35.67)

      expect(h.fetchStats).not.toHaveBeenCalled()
      expect(h.captured.suspiciousForm.selectedLocation).toEqual([139.72, 35.67])
      // 入力中ドラフトがアラート円レイヤーに渡る
      const draft = h.captured.suspiciousLayer.reports.find(
        (r: any) => r.id === '__suspicious_draft__',
      )
      expect(draft).toMatchObject({ latitude: 35.67, longitude: 139.72 })
      expect(h.captured.suspiciousLayer.isVisible).toBe(true)
    })
  })

  describe('表示切り替え', () => {
    it('3D トグール: terrain と sky レイヤーを設定し pitch を上げる', () => {
      renderMapContainer()
      fireMapLoad()

      act(() => {
        h.captured.floatingControls.toggle3DMode()
      })

      const map = lastMap()
      expect(map.setTerrain).toHaveBeenCalledWith({ source: 'mapbox-dem', exaggeration: 1.5 })
      expect(map.sources.has('mapbox-dem')).toBe(true)
      expect(map.layers.has('sky')).toBe(true)
      expect(map.setPitch).toHaveBeenCalledWith(60)

      act(() => {
        h.captured.floatingControls.toggle3DMode()
      })
      expect(map.setTerrain).toHaveBeenCalledWith(null)
      expect(map.setPitch).toHaveBeenCalledWith(0)
    })

    it('ハザードレイヤートグル: 洪水タイルのソースとレイヤーを追加・削除する', () => {
      renderMapContainer()
      fireMapLoad()

      act(() => {
        h.captured.routeHazardPanel.onToggleChange('flood', true)
      })

      const map = lastMap()
      expect(map.sources.has('hazard-flood-source')).toBe(true)
      expect(map.layers.has('hazard-flood-layer')).toBe(true)

      act(() => {
        h.captured.routeHazardPanel.onToggleChange('flood', false)
      })
      expect(map.sources.has('hazard-flood-source')).toBe(false)
      expect(map.layers.has('hazard-flood-layer')).toBe(false)
    })

    it('スタイル変更: setStyle が呼ばれる', () => {
      renderMapContainer()
      fireMapLoad()

      act(() => {
        h.captured.floatingControls.setMapStyle('dark-v11')
      })
      expect(lastMap().setStyle).toHaveBeenCalledWith('mapbox://styles/mapbox/dark-v11')
    })
  })

  describe('通学路の選択', () => {
    it('preferredRouteId が routes に存在すれば優先して選択する', () => {
      h.userRoutes.routes = [
        { id: 'route-a', name: 'ルートA' },
        { id: 'route-b', name: 'ルートB' },
      ]
      h.userRoutes.primaryRoute = { id: 'route-a', name: 'ルートA' }

      renderMapContainer({ preferredRouteId: 'route-b' })
      fireMapLoad()

      expect(h.captured.routeHazardPanel.selectedRouteId).toBe('route-b')
    })

    it('preferredRouteId が無ければ primaryRoute を選択する', () => {
      h.userRoutes.routes = [{ id: 'route-a', name: 'ルートA' }]
      h.userRoutes.primaryRoute = { id: 'route-a', name: 'ルートA' }

      renderMapContainer()
      fireMapLoad()

      expect(h.captured.routeHazardPanel.selectedRouteId).toBe('route-a')
    })
  })

  describe('レポート削除', () => {
    it('権限なし（他人のレポート）: 権限エラーを出して DB を触らない', async () => {
      h.admin.currentUserId = 'me'
      h.reports.dangerReports = [sampleReport({ id: 'r-1', user_id: 'someone-else', status: 'approved' })]

      renderMapContainer()
      fireMapLoad()

      await act(async () => {
        await h.captured.sidebar.onDeleteReport('r-1')
      })

      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '権限エラー', variant: 'destructive' }),
      )
      expect(h.supabase._spies.from).not.toHaveBeenCalled()
    })

    it('本人の pending レポート: confirm 承諾で DB から削除しローカル state を更新する', async () => {
      h.admin.currentUserId = 'user-1'
      h.reports.pendingReports = [sampleReport({ id: 'r-2', user_id: 'user-1', status: 'pending' })]
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      renderMapContainer()
      fireMapLoad()

      await act(async () => {
        await h.captured.sidebar.onDeleteReport('r-2')
      })

      expect(confirmSpy).toHaveBeenCalled()
      expect(h.supabase._spies.from).toHaveBeenCalledWith('danger_reports')
      expect(h.supabase._spies.eq).toHaveBeenCalledWith('id', 'r-2')
      expect(h.reports.setDangerReports).toHaveBeenCalled()
      expect(h.reports.setPendingReports).toHaveBeenCalled()
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '削除成功' }),
      )
      confirmSpy.mockRestore()
    })

    it('confirm 拒否なら削除しない', async () => {
      h.admin.isAdmin = true
      h.reports.dangerReports = [sampleReport({ id: 'r-3' })]
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      renderMapContainer()
      fireMapLoad()

      await act(async () => {
        await h.captured.sidebar.onDeleteReport('r-3')
      })

      expect(h.supabase._spies.from).not.toHaveBeenCalled()
      confirmSpy.mockRestore()
    })
  })

  describe('通学路ハザード取得', () => {
    it('ハザードトグルON かつ 経路選択済みなら API を取得しパネルへ渡す', async () => {
      const route = {
        id: 'route-a',
        name: 'ルートA',
        route_geometry: { type: 'LineString', coordinates: [[139.7, 35.68], [139.71, 35.69]] },
      }
      h.userRoutes.routes = [route]
      h.userRoutes.primaryRoute = route
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          markers: [
            {
              id: 'hz-1',
              hazard_type: 'flood',
              coordinates: [139.7, 35.68],
              title: '浸水想定',
              summary: 'テスト',
              risk_level: 3,
              depth_label: '0.5m',
              area_context: {},
              scenario_key: 'flood_l2',
            },
          ],
        }),
      }))
      vi.stubGlobal('fetch', fetchMock)

      renderMapContainer()
      fireMapLoad()

      act(() => {
        h.captured.routeHazardPanel.onToggleChange('flood', true)
      })

      await waitFor(() => {
        expect(h.captured.routeHazardPanel.hazards).toHaveLength(1)
      })
      expect(fetchMock).toHaveBeenCalledWith('/api/hazard/route-risks?routeId=route-a')
      expect(h.captured.routeHazardPanel.hazards[0]).toMatchObject({ id: 'hz-1' })
      // 経路ラインのレイヤーも追加されている
      expect(lastMap().sources.has('selected-user-route-source')).toBe(true)
      expect(lastMap().layers.has('selected-user-route-layer')).toBe(true)
    })

    it('ハザード画像生成はサーバ導出用の座標とシナリオだけを送る', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          imageUrl: 'https://example.com/hazard.png',
          prompt: 'prompt',
          cached: true,
          generatedAt: '2026-07-19T00:00:00.000Z',
          scenarioKey: 'flooded-road',
        }),
      }))
      vi.stubGlobal('fetch', fetchMock)
      renderMapContainer()
      fireMapLoad()

      act(() => {
        h.captured.routeHazardPanel.onHazardSelect({
          id: 'hz-1',
          hazard_type: 'flood',
          risk_level: 5,
          depth_min_m: 10,
          depth_max_m: 20,
          depth_label: '10m以上',
          area_context: 'coastal',
          area_label: '海岸近く',
          title: '洪水',
          summary: 'summary',
          explanation: 'explanation',
          evacuation_points: [],
          coordinates: [140.74, 40.82],
          scenario_options: [{ key: 'flooded-road' }],
          scenario_key: 'flooded-road',
        })
      })

      await act(async () => {
        await h.captured.hazardImageModal.onGenerate()
      })

      const imageCall = fetchMock.mock.calls.find(
        ([url]) => url === '/api/hazard/image',
      )
      expect(imageCall).toBeDefined()
      const init = imageCall?.[1] as RequestInit
      expect(JSON.parse(String(init.body))).toEqual({
        hazardType: 'flood',
        longitude: 140.74,
        latitude: 40.82,
        scenarioKey: 'flooded-road',
      })
    })
  })
})
