# Google Maps Style Map UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework the main map experience so the search bar is the top-most control, a Google Maps-like horizontal chip row exposes `3D`, `AR`, `事故ヒートマップ`, and `ハザード`, each chip opens its settings panel, and the map style control moves into the lower-right display control zone.

**Architecture:** Keep [`components/map/map-container.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-container.tsx) as the single owner of map UI state and introduce a new top-overlay component that renders the search shell, chip rail, and contextual panel host. Reuse existing search, 3D, AR, heatmap, and hazard logic by passing state and callbacks into the overlay, while simplifying [`components/map/map-floating-controls.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-floating-controls.tsx) so it owns only lower-right display controls and existing bottom CTAs.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS, shadcn/ui primitives, Vitest, Testing Library, Playwright

---

### Task 1: Add failing tests for the new top overlay shell

**Files:**
- Create: `tests/components/map/map-top-overlay.test.tsx`
- Test: `components/map/map-search.tsx`
- Test: `components/map/accident-heatmap-controls.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MapTopOverlay } from '@/components/map/map-top-overlay'

it('renders the search field first and shows a horizontal chip row', () => {
  render(
    <MapTopOverlay
      activePanel={null}
      is3DEnabled={false}
      isARMode={false}
      isHeatmapVisible={false}
      onPanelChange={() => {}}
      onToggle3D={() => {}}
      onToggleAR={() => {}}
      onToggleHeatmap={() => {}}
      searchSlot={<div>search-slot</div>}
      heatmapPanelSlot={<div>heatmap-panel</div>}
      hazardPanelSlot={<div>hazard-panel</div>}
      threeDPanelSlot={<div>3d-panel</div>}
      arPanelSlot={<div>ar-panel</div>}
    />,
  )

  expect(screen.getByText('search-slot')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '3D' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'AR' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '事故ヒートマップ' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'ハザード' })).toBeInTheDocument()
})

it('opens the matching panel when a chip is pressed', async () => {
  const user = userEvent.setup()
  const onPanelChange = vi.fn()

  render(
    <MapTopOverlay
      activePanel={null}
      is3DEnabled={false}
      isARMode={false}
      isHeatmapVisible={false}
      onPanelChange={onPanelChange}
      onToggle3D={() => {}}
      onToggleAR={() => {}}
      onToggleHeatmap={() => {}}
      searchSlot={<div>search-slot</div>}
      heatmapPanelSlot={<div>heatmap-panel</div>}
      hazardPanelSlot={<div>hazard-panel</div>}
      threeDPanelSlot={<div>3d-panel</div>}
      arPanelSlot={<div>ar-panel</div>}
    />,
  )

  await user.click(screen.getByRole('button', { name: '事故ヒートマップ' }))

  expect(onPanelChange).toHaveBeenCalledWith('heatmap')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/map-top-overlay.test.tsx`

Expected: FAIL because `MapTopOverlay` does not exist yet.

**Step 3: Write minimal implementation**

Create only the test file. Do not add production code yet.

**Step 4: Run test to verify it fails for the right reason**

Run: `npx vitest run tests/components/map/map-top-overlay.test.tsx`

Expected: FAIL with module-not-found or missing export errors for `map-top-overlay`.

**Step 5: Commit**

```bash
git add tests/components/map/map-top-overlay.test.tsx
git commit -m "test: cover map top overlay shell"
```

### Task 2: Implement the reusable top overlay component

**Files:**
- Create: `components/map/map-top-overlay.tsx`
- Modify: `components/map/map-search.tsx`
- Test: `tests/components/map/map-top-overlay.test.tsx`

**Step 1: Write the failing test**

Use the tests from Task 1 as the active target. Add one more assertion for contextual panel rendering.

```tsx
it('renders the active contextual panel below the chip rail', () => {
  render(
    <MapTopOverlay
      activePanel="hazard"
      is3DEnabled={false}
      isARMode={false}
      isHeatmapVisible={false}
      onPanelChange={() => {}}
      onToggle3D={() => {}}
      onToggleAR={() => {}}
      onToggleHeatmap={() => {}}
      searchSlot={<div>search-slot</div>}
      heatmapPanelSlot={<div>heatmap-panel</div>}
      hazardPanelSlot={<div>hazard-panel</div>}
      threeDPanelSlot={<div>3d-panel</div>}
      arPanelSlot={<div>ar-panel</div>}
    />,
  )

  expect(screen.getByText('hazard-panel')).toBeInTheDocument()
  expect(screen.queryByText('heatmap-panel')).not.toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/map-top-overlay.test.tsx`

Expected: FAIL before the new overlay exists.

**Step 3: Write minimal implementation**

```tsx
type MapTopOverlayPanel = '3d' | 'ar' | 'heatmap' | 'hazard' | null

interface MapTopOverlayProps {
  activePanel: MapTopOverlayPanel
  is3DEnabled: boolean
  isARMode: boolean
  isHeatmapVisible: boolean
  onPanelChange: (panel: MapTopOverlayPanel) => void
  onToggle3D: () => void
  onToggleAR: () => void
  onToggleHeatmap: () => void
  searchSlot: React.ReactNode
  threeDPanelSlot: React.ReactNode
  arPanelSlot: React.ReactNode
  heatmapPanelSlot: React.ReactNode
  hazardPanelSlot: React.ReactNode
}

const CHIP_CONFIG = [
  { id: '3d', label: '3D' },
  { id: 'ar', label: 'AR' },
  { id: 'heatmap', label: '事故ヒートマップ' },
  { id: 'hazard', label: 'ハザード' },
] as const

export function MapTopOverlay(props: MapTopOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-x-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-30">
      <div className="pointer-events-auto mx-auto flex max-w-2xl flex-col gap-2">
        <div className="rounded-full border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur-sm">
          {props.searchSlot}
        </div>
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-2 pb-1">
            {CHIP_CONFIG.map((chip) => (
              <button
                key={chip.id}
                type="button"
                aria-label={chip.label}
                className="rounded-full border bg-white px-4 py-2 text-sm shadow-sm"
                onClick={() => props.onPanelChange(chip.id)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
        {props.activePanel === '3d' && <div>{props.threeDPanelSlot}</div>}
        {props.activePanel === 'ar' && <div>{props.arPanelSlot}</div>}
        {props.activePanel === 'heatmap' && <div>{props.heatmapPanelSlot}</div>}
        {props.activePanel === 'hazard' && <div>{props.hazardPanelSlot}</div>}
      </div>
    </div>
  )
}
```

Update `map-search.tsx` so it can render inside the new rounded search shell cleanly:

```tsx
interface MapSearchProps {
  map: mapboxgl.Map | null
  onSelectLocation?: (coordinates: [number, number]) => void
  className?: string
  inputClassName?: string
}
```

Use `className` and `inputClassName` instead of hard-coded white card styling in the root shell.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/map/map-top-overlay.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add components/map/map-top-overlay.tsx components/map/map-search.tsx tests/components/map/map-top-overlay.test.tsx
git commit -m "feat: add google maps style top overlay"
```

### Task 3: Wire the overlay into the map container and map each chip to existing state

**Files:**
- Modify: `components/map/map-container.tsx`
- Modify: `tests/components/map/map-page-client.test.tsx`
- Optional Modify: `tests/components/map/route-hazard-panel.test.tsx`

**Step 1: Write the failing test**

Add a map-level render contract that expects the new overlay controls to exist.

```tsx
it('shows the top search overlay and chip row on the map page', async () => {
  render(<MapPageClient />)

  expect(await screen.findByRole('button', { name: '3D' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'AR' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '事故ヒートマップ' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'ハザード' })).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/map-page-client.test.tsx tests/components/map/map-top-overlay.test.tsx`

Expected: FAIL because `map-container` has not mounted the new overlay.

**Step 3: Write minimal implementation**

In `map-container.tsx`:

- add `activeTopPanel` state
- render `MapTopOverlay`
- pass `MapSearch` as `searchSlot`
- map chips to current state changes:
  - `3d` toggles `is3DEnabled` and sets `activeTopPanel='3d'`
  - `ar` toggles `isARMode` and sets `activeTopPanel='ar'`
  - `heatmap` ensures `accidentHeatmap.isVisible` and sets `activeTopPanel='heatmap'`
  - `hazard` sets `activeTopPanel='hazard'`

Example shape:

```tsx
const [activeTopPanel, setActiveTopPanel] = useState<MapTopOverlayPanel>(null)

const handleTopPanelChange = (panel: MapTopOverlayPanel) => {
  if (panel === '3d') {
    if (!is3DEnabled) setIs3DEnabled(true)
    setActiveTopPanel('3d')
    return
  }
  if (panel === 'ar') {
    if (!isARMode) setIsARMode(true)
    setActiveTopPanel('ar')
    return
  }
  if (panel === 'heatmap') {
    if (!accidentHeatmap.isVisible) accidentHeatmap.toggleVisibility()
    setActiveTopPanel('heatmap')
    return
  }
  if (panel === 'hazard') {
    setActiveTopPanel('hazard')
    return
  }
  setActiveTopPanel(null)
}
```

Pass lightweight panel slots:

- `threeDPanelSlot`: a compact card wrapping `Map3DToggle`
- `arPanelSlot`: a compact explanatory card and open/close action
- `heatmapPanelSlot`: `AccidentHeatmapControls` in mobile/overlay-friendly mode
- `hazardPanelSlot`: `RouteHazardPanel` or a reduced shell around it

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/map/map-page-client.test.tsx tests/components/map/map-top-overlay.test.tsx`

Expected: PASS with the new overlay contract in place.

**Step 5: Commit**

```bash
git add components/map/map-container.tsx tests/components/map/map-page-client.test.tsx
git commit -m "feat: wire top map overlay into map container"
```

### Task 4: Move the style selector into the lower-right display control zone and remove conflicting top controls

**Files:**
- Modify: `components/map/map-floating-controls.tsx`
- Modify: `components/map/map-style-selector.tsx`
- Modify: `tests/components/map/map-floating-controls.test.tsx`

**Step 1: Write the failing test**

Add assertions that the style selector still exists, but now lives in the lower-right display controls while top-of-map discovery actions are absent from that component.

```tsx
it('keeps the style selector in the display control group', () => {
  render(
    <MapFloatingControls
      onAddReport={() => {}}
      isReportFormOpen={false}
      mapStyle="streets-v12"
      setMapStyle={() => {}}
      is3DEnabled={false}
      toggle3DMode={() => {}}
    />,
  )

  expect(screen.getByRole('button', { name: /地図スタイル/i })).toBeInTheDocument()
})
```

Add a regression check that `MapFloatingControls` no longer acts as the primary top-of-screen control owner.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/map-floating-controls.test.tsx`

Expected: FAIL if the component test expectations still match the old zoning.

**Step 3: Write minimal implementation**

Update `map-floating-controls.tsx` to:

- keep the lower-right display stack
- preserve map style access there
- remove or reduce duplicated top-of-map controls that are now handled by `MapTopOverlay`

Update `map-style-selector.tsx` so the trigger can use a compact icon-first treatment:

```tsx
<MapStyleSelector
  currentStyle={mapStyle}
  onChange={setMapStyle}
  buttonClassName="h-10 w-10 rounded-full p-0"
  compactLabel={true}
  buttonLabel="地図スタイル"
/>
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/map/map-floating-controls.test.tsx tests/components/map/map-top-overlay.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add components/map/map-floating-controls.tsx components/map/map-style-selector.tsx tests/components/map/map-floating-controls.test.tsx
git commit -m "refactor: move map style control to display stack"
```

### Task 5: Verify responsive layout and chip-driven settings behavior

**Files:**
- Modify: `tests/responsive/map-ui-layout.spec.ts`
- Optional Modify: `tests/components/map/route-hazard-panel.test.tsx`
- Optional Modify: `tests/components/map/accident-heatmap-controls.test.tsx`

**Step 1: Write the failing test**

Add a mobile responsive expectation for the new layout.

```ts
test('mobile map shows search first and chip rail below it', async ({ page }) => {
  await page.goto('/map')

  await expect(page.getByPlaceholder('住所や場所を検索...')).toBeVisible()
  await expect(page.getByRole('button', { name: '3D' })).toBeVisible()
  await expect(page.getByRole('button', { name: '事故ヒートマップ' })).toBeVisible()
})

test('heatmap chip opens its settings surface', async ({ page }) => {
  await page.goto('/map')
  await page.getByRole('button', { name: '事故ヒートマップ' }).click()
  await expect(page.getByText('対象期間')).toBeVisible()
})
```

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/responsive/map-ui-layout.spec.ts --project="Mobile Chrome - iPhone 12"`

Expected: FAIL before the responsive overlay flow is complete.

**Step 3: Write minimal implementation**

Only make the CSS and layout adjustments needed to satisfy the tests:

- ensure the search bar remains visually first
- keep the chip rail horizontally scrollable instead of wrapping awkwardly
- ensure the active panel does not cover the chip rail itself
- ensure the lower-right style selector remains reachable on mobile and desktop

Manual verification checklist:

```text
1. Open the main map page on mobile.
2. Confirm the search bar is the top-most control.
3. Confirm the chip row scrolls horizontally and contains 3D, AR, 事故ヒートマップ, ハザード.
4. Tap each chip and confirm its matching panel opens.
5. Confirm the style selector is in the lower-right control zone.
6. Confirm report and current-location actions still work.
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/map/map-top-overlay.test.tsx tests/components/map/map-floating-controls.test.tsx tests/components/map/map-page-client.test.tsx`

Run: `npx playwright test tests/responsive/map-ui-layout.spec.ts --project="Mobile Chrome - iPhone 12"`

Expected: PASS. If Playwright selectors need stabilization, update them before calling the task complete.

**Step 5: Commit**

```bash
git add tests/responsive/map-ui-layout.spec.ts tests/components/map/map-top-overlay.test.tsx tests/components/map/map-floating-controls.test.tsx tests/components/map/map-page-client.test.tsx
git commit -m "test: verify google maps style map layout"
```
