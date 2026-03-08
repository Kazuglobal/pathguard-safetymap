# Mobile Accident Heatmap Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the persistent mobile accident heatmap card with a top-left trigger and bottom drawer while preserving the existing desktop control card.

**Architecture:** Keep `AccidentHeatmapControls` as the single owner of the heatmap control UI, but split its rendering into desktop and mobile variants. The map container continues to own heatmap state and passes it into the control component, while mobile placement moves to the top-left zone and remains accessible even when the heatmap is hidden.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS, shadcn/ui `drawer`, Vitest, Testing Library

---

### Task 1: Add failing component tests for the new mobile control pattern

**Files:**
- Modify: `tests/components/map/accident-heatmap-controls.test.tsx`

**Step 1: Write the failing test**

```tsx
it('renders a compact mobile trigger instead of the desktop card shell', () => {
  render(
    <AccidentHeatmapControls
      filters={DEFAULT_HEATMAP_FILTERS}
      onFiltersChange={vi.fn()}
      isVisible={false}
      onToggleVisibility={vi.fn()}
      isLoading={false}
      featureCount={0}
      error={null}
      isMobile={true}
    />,
  )

  expect(screen.getByRole('button', { name: '事故ヒートマップ設定を開く' })).toBeInTheDocument()
  expect(screen.queryByText('対象期間')).not.toBeInTheDocument()
})

it('opens the mobile drawer and exposes the same filter controls', () => {
  render(
    <AccidentHeatmapControls
      filters={{ ...DEFAULT_HEATMAP_FILTERS, childFilter: true }}
      onFiltersChange={vi.fn()}
      isVisible={true}
      onToggleVisibility={vi.fn()}
      isLoading={false}
      featureCount={128}
      error={null}
      isMobile={true}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: '事故ヒートマップ設定を開く' }))

  expect(screen.getByText('対象期間')).toBeInTheDocument()
  expect(screen.getByText('128件表示中')).toBeInTheDocument()
  expect(screen.getByText('子ども関与（補充票確認分）のみ')).toBeInTheDocument()
  expect(screen.getByText('1')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx`

Expected: FAIL because `isMobile` handling and the mobile trigger/drawer UI do not exist yet.

**Step 3: Write minimal implementation**

Add test cases only. Do not change production code yet.

**Step 4: Run test to verify it fails for the right reason**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx`

Expected: FAIL with missing mobile trigger assertions or prop/type errors tied to the new behavior.

**Step 5: Commit**

```bash
git add tests/components/map/accident-heatmap-controls.test.tsx
git commit -m "test: cover mobile accident heatmap controls"
```

### Task 2: Implement mobile trigger and drawer in `AccidentHeatmapControls`

**Files:**
- Modify: `components/map/accident-heatmap-controls.tsx`
- Test: `tests/components/map/accident-heatmap-controls.test.tsx`

**Step 1: Write the failing test**

Use the tests from Task 1 as the active failing target.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx`

Expected: FAIL before production changes.

**Step 3: Write minimal implementation**

```tsx
interface AccidentHeatmapControlsProps {
  filters: AccidentHeatmapFilters
  onFiltersChange: (patch: Partial<AccidentHeatmapFilters>) => void
  isVisible: boolean
  onToggleVisibility: () => void
  isLoading: boolean
  featureCount: number
  error: string | null
  isMobile?: boolean
}

function countActiveFilters(filters: AccidentHeatmapFilters) {
  let count = 0
  if (filters.childFilter) count += 1
  if (filters.youngFilter) count += 1
  if (filters.pedestrianFilter) count += 1
  if (filters.severityFilter !== 'all') count += 1
  if (filters.minYear !== YEAR_OPTIONS[0] || filters.maxYear !== YEAR_OPTIONS[YEAR_OPTIONS.length - 1]) {
    count += 1
  }
  return count
}

function HeatmapFilterContent(props: AccidentHeatmapControlsProps) {
  return (
    <div className="space-y-3">
      {/* existing status, selects, switches, and hint content moved here */}
    </div>
  )
}

export function AccidentHeatmapControls({
  isMobile = false,
  ...props
}: AccidentHeatmapControlsProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const activeFilterCount = countActiveFilters(props.filters)

  if (isMobile) {
    return (
      <>
        <div className="absolute left-3 top-[calc(env(safe-area-inset-top,0px)+4.25rem)] z-20">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full border-gray-200/80 bg-white/95 px-3 shadow-lg backdrop-blur-sm"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="事故ヒートマップ設定を開く"
          >
            <Flame className="h-4 w-4" />
            <span>事故</span>
            {activeFilterCount > 0 && <Badge>{activeFilterCount}</Badge>}
          </Button>
        </div>

        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerContent className="max-h-[64svh] rounded-t-3xl px-0 pb-6">
            <DrawerHeader className="px-4 text-left">
              <DrawerTitle>事故ヒートマップ</DrawerTitle>
              <DrawerDescription>表示切替と絞り込み条件を設定します</DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4">
              <HeatmapFilterContent {...props} isMobile />
            </div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <div className="w-56 ...">
      {/* existing desktop card shell */}
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx`

Expected: PASS with desktop assertions still green and new mobile assertions passing.

**Step 5: Commit**

```bash
git add components/map/accident-heatmap-controls.tsx tests/components/map/accident-heatmap-controls.test.tsx
git commit -m "feat: move mobile heatmap controls into drawer"
```

### Task 3: Wire the control into the map container with mobile-specific placement

**Files:**
- Modify: `components/map/map-container.tsx`
- Test: `tests/components/map/accident-heatmap-controls.test.tsx`

**Step 1: Write the failing test**

Extend the component test to cover the map-level usage contract indirectly by checking that the mobile trigger can render while `isVisible={false}` and still open the drawer.

```tsx
it('keeps the mobile trigger available even when the heatmap is hidden', () => {
  render(
    <AccidentHeatmapControls
      filters={DEFAULT_HEATMAP_FILTERS}
      onFiltersChange={vi.fn()}
      isVisible={false}
      onToggleVisibility={vi.fn()}
      isLoading={false}
      featureCount={0}
      error={null}
      isMobile={true}
    />,
  )

  expect(screen.getByRole('button', { name: '事故ヒートマップ設定を開く' })).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx`

Expected: FAIL if the component still assumes it only renders after the heatmap is already visible.

**Step 3: Write minimal implementation**

Update the render gate in `components/map/map-container.tsx` so mobile no longer depends on `accidentHeatmap.isVisible` to render the control at all.

```tsx
{((!isMobile && !awaitingLocationSelection) ||
  (isMobile && !awaitingLocationSelection && !isReportFormOpen)) && (
  <div
    className={
      isMobile
        ? 'absolute left-3 top-[calc(env(safe-area-inset-top,0px)+4.25rem)] z-20'
        : 'absolute left-3 z-10 bottom-[calc(env(safe-area-inset-bottom,0px)+2rem)] sm:left-auto sm:right-3 sm:bottom-6'
    }
  >
    <AccidentHeatmapControls
      filters={accidentHeatmap.filters}
      onFiltersChange={accidentHeatmap.setFilters}
      isVisible={accidentHeatmap.isVisible}
      onToggleVisibility={accidentHeatmap.toggleVisibility}
      isLoading={accidentHeatmap.isLoading}
      featureCount={accidentHeatmap.featureCount}
      error={accidentHeatmap.error}
      isMobile={isMobile}
    />
  </div>
)}
```

Keep the mobile wrapper minimal if the component itself owns the trigger position to avoid double-positioning.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx tests/components/map/map-floating-controls.test.tsx`

Expected: PASS, including the existing mobile dock behavior expectations.

**Step 5: Commit**

```bash
git add components/map/map-container.tsx tests/components/map/accident-heatmap-controls.test.tsx
git commit -m "fix: keep mobile heatmap trigger accessible"
```

### Task 4: Verify the responsive behavior and guard against regressions

**Files:**
- Modify: `tests/components/map/accident-heatmap-controls.test.tsx`
- Optional Modify: `tests/integration/accident-heatmap-filters.spec.ts`

**Step 1: Write the failing test**

If browser coverage is needed, add a mobile-oriented assertion that the trigger opens the drawer before interacting with filters.

```ts
test('mobile opens the heatmap drawer before changing filters', async ({ page }) => {
  await page.goto('/map')
  await page.getByRole('button', { name: '事故ヒートマップ設定を開く' }).click()
  await expect(page.getByText('対象期間')).toBeVisible()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx`

Optional browser run: `npx playwright test tests/integration/accident-heatmap-filters.spec.ts --project="Mobile Chrome - iPhone 12"`

Expected: component tests PASS first; browser test may FAIL until selectors are updated for the mobile drawer flow.

**Step 3: Write minimal implementation**

Only update browser selectors if the project already maintains mobile Playwright coverage for `/map`. Otherwise stop at component coverage and document the manual verification path.

Manual verification checklist:

```text
1. Open /map in a mobile viewport.
2. Confirm only the top-left "事故" trigger is visible.
3. Open the drawer and toggle heatmap visibility on.
4. Apply child or young filters and confirm the badge count appears.
5. Close the drawer and confirm the map remains visible behind the trigger.
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx tests/components/map/map-floating-controls.test.tsx`

Optional: `npm run test:components`

Expected: PASS. If browser coverage was added, the mobile selector flow also passes.

**Step 5: Commit**

```bash
git add tests/components/map/accident-heatmap-controls.test.tsx tests/integration/accident-heatmap-filters.spec.ts
git commit -m "test: verify mobile heatmap drawer flow"
```
