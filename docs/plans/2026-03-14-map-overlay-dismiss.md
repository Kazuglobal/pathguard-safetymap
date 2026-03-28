# Map Overlay Dismiss Behavior Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let the top map panels close when the user re-taps the same chip or taps the map canvas, and also let a map tap close the search suggestion list without clearing the search input.

**Architecture:** Keep `activeTopPanel` state in [`components/map/map-container.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-container.tsx), teach [`components/map/map-top-overlay.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-top-overlay.tsx) to toggle the active chip closed on re-tap, and add an external dismiss signal to [`components/map/map-search.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-search.tsx) so the map container can close only the suggestion list. This preserves current feature states while reducing obstructive UI.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS, Vitest, Testing Library, Mapbox GL JS

---

### Task 1: Add failing tests for same-chip re-tap dismissal in `MapTopOverlay`

**Files:**
- Modify: `tests/components/map/map-top-overlay.test.tsx`
- Test: `components/map/map-top-overlay.tsx`

**Step 1: Write the failing test**

```tsx
it('closes the active panel when the same chip is tapped again', async () => {
  const user = userEvent.setup()
  const onPanelChange = vi.fn()

  render(
    <MapTopOverlay
      activePanel="heatmap"
      is3DEnabled={false}
      isARMode={false}
      isHeatmapVisible={true}
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

  expect(onPanelChange).toHaveBeenCalledWith(null)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/map-top-overlay.test.tsx`

Expected: FAIL because the component currently re-sends the active panel id instead of closing it.

**Step 3: Write minimal implementation**

Only add the test. Do not change production code yet.

**Step 4: Run test to verify it fails for the right reason**

Run: `npx vitest run tests/components/map/map-top-overlay.test.tsx`

Expected: FAIL with an assertion showing `heatmap` was emitted instead of `null`.

**Step 5: Commit**

```bash
git add tests/components/map/map-top-overlay.test.tsx
git commit -m "test: cover top overlay dismiss behavior"
```

### Task 2: Add map-driven dismiss signal support to `MapSearch`

**Files:**
- Modify: `tests/components/map/map-search.test.tsx`
- Modify: `components/map/map-search.tsx`

**Step 1: Write the failing test**

```tsx
it('hides results when an external dismiss signal changes without clearing the query', async () => {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      features: [
        { id: 'place.1', place_name: '東京都千代田区', center: [139.75, 35.68] },
      ],
    }),
  } as Response)

  const { rerender } = render(
    <MapSearch
      map={{ flyTo: mockFlyTo, getCenter: mockGetCenter } as never}
      dismissResultsSignal={0}
    />,
  )

  fireEvent.change(screen.getByPlaceholderText('住所や場所を検索...'), {
    target: { value: '東京' },
  })
  fireEvent.submit(screen.getByRole('button', { name: /search/i }).closest('form')!)

  expect(await screen.findByText('東京都千代田区')).toBeInTheDocument()

  rerender(
    <MapSearch
      map={{ flyTo: mockFlyTo, getCenter: mockGetCenter } as never}
      dismissResultsSignal={1}
    />,
  )

  expect(screen.queryByText('東京都千代田区')).not.toBeInTheDocument()
  expect(screen.getByPlaceholderText('住所や場所を検索...')).toHaveValue('東京')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/map-search.test.tsx`

Expected: FAIL because `dismissResultsSignal` does not exist yet.

**Step 3: Write minimal implementation**

Add a new optional prop and a small effect:

```tsx
interface MapSearchProps {
  map: mapboxgl.Map | null
  onSelectLocation?: (coordinates: [number, number]) => void
  className?: string
  inputClassName?: string
  dismissResultsSignal?: number
}

useEffect(() => {
  setShowResults(false)
}, [dismissResultsSignal])
```

Do not modify query state inside this effect.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/map/map-search.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add components/map/map-search.tsx tests/components/map/map-search.test.tsx
git commit -m "feat: add external dismiss signal for map search"
```

### Task 3: Wire map tap dismissal through `map-container`

**Files:**
- Modify: `components/map/map-container.tsx`
- Modify: `tests/components/map/map-top-overlay.test.tsx`
- Optional Modify: `tests/components/map/map-page-client.test.tsx`

**Step 1: Write the failing test**

Extend the `MapTopOverlay` test to verify chip switching still works while same-chip re-tap closes:

```tsx
it('switches panels when a different chip is tapped', async () => {
  const user = userEvent.setup()
  const onPanelChange = vi.fn()

  render(
    <MapTopOverlay
      activePanel="heatmap"
      is3DEnabled={false}
      isARMode={false}
      isHeatmapVisible={true}
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

  await user.click(screen.getByRole('button', { name: 'ハザード' }))

  expect(onPanelChange).toHaveBeenCalledWith('hazard')
})
```

If `map-container` test coverage is practical in this codebase, add a lightweight integration check around map tap dismissal. Otherwise verify `map-container` via typecheck plus targeted manual steps.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/map-top-overlay.test.tsx`

Expected: FAIL until `MapTopOverlay` toggles active chips closed.

**Step 3: Write minimal implementation**

In `map-top-overlay.tsx`:

```tsx
const handleChipClick = (panel: Exclude<MapTopOverlayPanel, null>) => {
  if (props.activePanel === panel) {
    props.onPanelChange(null)
    return
  }
  // existing toggle/open logic
}
```

In `map-container.tsx`:

- add `dismissSearchResultsSignal` state
- when the map canvas is tapped in the normal map interaction path, call:

```tsx
setActiveTopPanel(null)
setDismissSearchResultsSignal((prev) => prev + 1)
```

- pass the signal into `MapSearch`

```tsx
<MapSearch
  map={map.current}
  dismissResultsSignal={dismissSearchResultsSignal}
  ...
/>
```

Only do this in the normal map-tap path, not in flows where location selection intentionally needs the map click.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/map/map-top-overlay.test.tsx tests/components/map/map-search.test.tsx`

Run: `npm run typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add components/map/map-container.tsx components/map/map-top-overlay.tsx tests/components/map/map-top-overlay.test.tsx tests/components/map/map-search.test.tsx
git commit -m "feat: dismiss map overlay panels from chip and map taps"
```

### Task 4: Verify no regression in existing map overlay components

**Files:**
- Modify: `tests/components/map/route-hazard-panel.test.tsx`
- Modify: `tests/components/map/map-floating-controls.test.tsx`

**Step 1: Write the failing test**

Only if needed, add a defensive assertion that the inline hazard panel still renders correctly when used inside the top overlay flow.

```tsx
it('inline hazard panel still renders route hazard content for overlay use', () => {
  render(<RouteHazardPanel {...defaultProps} variant="inline" />)

  expect(screen.getByText('通学ルートハザード')).toBeInTheDocument()
  expect(screen.getByText('洪水浸水想定')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/route-hazard-panel.test.tsx tests/components/map/map-floating-controls.test.tsx`

Expected: Either PASS already, or FAIL only if the dismiss wiring accidentally regressed shared map UI.

**Step 3: Write minimal implementation**

Only fix regressions caused by the dismiss change. Do not broaden the scope.

Manual verification checklist:

```text
1. Open /map.
2. Tap 事故ヒートマップ to open the panel.
3. Tap 事故ヒートマップ again and confirm the panel closes.
4. Open ハザード or 3D and tap the map area to confirm the panel closes.
5. Type in search so results appear, then tap the map and confirm the results close but the text remains.
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/map/map-top-overlay.test.tsx tests/components/map/map-search.test.tsx tests/components/map/route-hazard-panel.test.tsx tests/components/map/map-floating-controls.test.tsx`

Run: `npm run typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/components/map/map-top-overlay.test.tsx tests/components/map/map-search.test.tsx tests/components/map/route-hazard-panel.test.tsx tests/components/map/map-floating-controls.test.tsx
git commit -m "test: verify map overlay dismiss interactions"
```
