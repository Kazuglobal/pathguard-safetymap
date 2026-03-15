# Map Selection UI Clarity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the mobile map easier to understand by separating action buttons from display controls, turning the map display trigger into an explicit `表示` entry point, and clarifying which bottom action is primary.

**Architecture:** Keep [`components/map/map-container.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-container.tsx) as the single owner of map state, while extending the display-control surface through a new sheet/popup component used by [`components/map/map-style-selector.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-style-selector.tsx). Rework [`components/map/map-floating-controls.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-floating-controls.tsx) so the bottom dock communicates a stronger action hierarchy without breaking existing reporting and GPS callbacks.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS, shadcn/ui, Vaul Drawer, Vitest, Testing Library, Playwright

---

### Task 1: Add failing tests for the explicit `表示` trigger and grouped display content

**Files:**
- Create: `tests/components/map/map-style-selector.test.tsx`
- Test: `components/map/map-style-selector.tsx`
- Reference: `components/ui/drawer.tsx`

**Step 1: Write the failing test**

Create a new component test that covers the richer display entry point while keeping compatibility with the simple current usage.

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import MapStyleSelector from "@/components/map/map-style-selector"

describe("MapStyleSelector", () => {
  it("renders an explicit display trigger label", () => {
    render(
      <MapStyleSelector
        currentStyle="streets-v12"
        onChange={() => {}}
        compactLabel={false}
        buttonLabel="表示"
      />,
    )

    expect(screen.getByRole("button", { name: "表示" })).toBeInTheDocument()
  })

  it("opens grouped display content on mobile", async () => {
    const user = userEvent.setup()

    render(
      <MapStyleSelector
        currentStyle="streets-v12"
        onChange={() => {}}
        isMobile
        buttonLabel="表示"
        overlayOptions={[
          { id: "route", label: "通学路", description: "通学路を表示", selected: true, onSelect: vi.fn() },
          { id: "danger", label: "危険・注意", description: "危険情報を表示", selected: false, onSelect: vi.fn() },
        ]}
      />,
    )

    await user.click(screen.getByRole("button", { name: "表示" }))

    expect(screen.getByText("表示する情報")).toBeInTheDocument()
    expect(screen.getByText("地図の見た目")).toBeInTheDocument()
    expect(screen.getByText("地図に重ねる情報")).toBeInTheDocument()
    expect(screen.getByText("通学路")).toBeInTheDocument()
    expect(screen.getByText("危険・注意")).toBeInTheDocument()
    expect(screen.getByText("表示中")).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/map/map-style-selector.test.tsx`

Expected: FAIL because `MapStyleSelector` does not yet expose `isMobile`, `overlayOptions`, grouped content, or the `表示する情報` sheet.

**Step 3: Write minimal implementation**

Do not change production code yet. Create only the new failing test file so the expected API and behavior are explicit.

**Step 4: Run test to verify it fails for the right reason**

Run: `pnpm vitest run tests/components/map/map-style-selector.test.tsx`

Expected: FAIL with prop/type/runtime mismatches pointing at missing grouped display UI.

**Step 5: Commit**

```bash
git add tests/components/map/map-style-selector.test.tsx
git commit -m "test: cover grouped map display selector"
```

### Task 2: Implement the grouped display selector without breaking existing consumers

**Files:**
- Modify: `components/map/map-style-selector.tsx`
- Optional Create: `components/map/map-display-sheet.tsx`
- Test: `tests/components/map/map-style-selector.test.tsx`
- Reference: `components/map/map-header.tsx`
- Reference: `components/map/route-hazard-panel.tsx`

**Step 1: Write the failing test**

Extend the Task 1 test file with one compatibility regression test so old consumers still work.

```tsx
it("still supports the simple style-only dropdown contract", async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()

  render(
    <MapStyleSelector
      currentStyle="streets-v12"
      onChange={onChange}
    />,
  )

  await user.click(screen.getByRole("button"))
  await user.click(screen.getByText("航空写真"))

  expect(onChange).toHaveBeenCalledWith("satellite-v9")
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/map/map-style-selector.test.tsx`

Expected: FAIL because the new grouped UI and the old simple mode cannot both pass until the component is refactored.

**Step 3: Write minimal implementation**

Refactor [`components/map/map-style-selector.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-style-selector.tsx) into two modes:

- `simple mode` for existing uses in `map-header.tsx` and `route-hazard-panel.tsx`
- `display mode` for the main map page when richer props are passed

Suggested prop shape:

```tsx
interface MapDisplayOption {
  id: string
  label: string
  description: string
  selected: boolean
  onSelect: () => void
}

interface MapStyleSelectorProps {
  currentStyle: string
  onChange: (style: string) => void
  buttonClassName?: string
  contentAlign?: "start" | "center" | "end"
  compactLabel?: boolean
  buttonLabel?: string
  isMobile?: boolean
  overlayOptions?: MapDisplayOption[]
}
```

Implementation notes:

- Keep the existing dropdown menu behavior when `overlayOptions` is not provided.
- When `overlayOptions` is provided, render:
  - a labeled `表示` trigger
  - a mobile `Drawer` using [`components/ui/drawer.tsx`](C:/Users/s1598/mapsefe/20250615/components/ui/drawer.tsx)
  - a desktop dropdown or popover with the same grouped content
- Group styles into `地図の見た目`
- Group overlays into `地図に重ねる情報`
- Add a visible `表示中` pill or equivalent selected badge for active items

If extraction reduces complexity, create [`components/map/map-display-sheet.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-display-sheet.tsx) and keep `MapStyleSelector` as the trigger/controller.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/map/map-style-selector.test.tsx`

Expected: PASS, with both grouped display mode and simple style-only compatibility covered.

**Step 5: Commit**

```bash
git add components/map/map-style-selector.tsx components/map/map-display-sheet.tsx tests/components/map/map-style-selector.test.tsx
git commit -m "feat: add grouped map display selector"
```

### Task 3: Rework the bottom action dock hierarchy and state handling

**Files:**
- Modify: `components/map/map-floating-controls.tsx`
- Modify: `tests/components/map/map-floating-controls.test.tsx`
- Modify: `tests/components/map-floating-controls-gps.test.tsx`
- Reference: `lib/map-overlay-ui.ts`

**Step 1: Write the failing test**

Update the floating-controls tests so they assert the intended hierarchy and focused-state behavior.

Add cases like:

```tsx
it("renders a labeled display trigger above the mobile action dock", () => {
  renderControls()

  expect(screen.getByRole("button", { name: "表示" })).toBeInTheDocument()
})

it("keeps report as the primary mobile action", () => {
  renderControls()

  const reportButton = screen.getByRole("button", { name: "危険箇所を報告する" })
  expect(reportButton).toHaveTextContent("危険を報告")
  expect(reportButton.className).toMatch(/from-blue-600/)
})

it("reduces competing actions while location selection is active", () => {
  renderControls({ isSelectingLocation: true })

  expect(screen.getByText("地点選択中")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "危険地点一覧を開く" })).not.toBeInTheDocument()
})
```

Update the GPS test to keep the accessibility contract stable:

```tsx
expect(screen.getByRole("button", { name: /現在地で報告/ })).toBeInTheDocument()
expect(screen.getByText("現在地")).toBeInTheDocument()
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/map/map-floating-controls.test.tsx tests/components/map-floating-controls-gps.test.tsx`

Expected: FAIL because the current dock still uses the old visual hierarchy and hides the whole dock during focused states.

**Step 3: Write minimal implementation**

Update [`components/map/map-floating-controls.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-floating-controls.tsx) to:

- relabel the display trigger to `表示`
- keep the map display trigger separate from the bottom action dock
- preserve the bottom action order: `一覧`, `現在地`, `危険を報告`
- strengthen the visual hierarchy:
  - neutral `一覧`
  - green-tinted `現在地`
  - blue filled primary CTA for `危険を報告`
- replace the current all-or-nothing mobile dock hiding with a focused state row when `isSelectingLocation` or `isReportFormOpen` is true

Example focused-state shape:

```tsx
const showFocusedDock = isMobile && (isSelecting || isReportFormOpen)

{showFocusedDock ? (
  <div data-testid="mobile-focused-dock">
    <div className="rounded-2xl border bg-white/95 p-3 shadow-xl">
      <p className="text-sm font-semibold text-slate-900">
        {isSelecting ? "地点選択中" : "報告入力中"}
      </p>
      <p className="text-xs text-slate-500">
        {isSelecting ? "地図をタップして地点を決めてください" : "内容を確認して送信してください"}
      </p>
    </div>
  </div>
) : (
  // existing three-action dock with stronger hierarchy
)}
```

Keep `aria-label="現在地で報告"` so existing GPS-focused tests and assistive behavior do not regress.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/map/map-floating-controls.test.tsx tests/components/map-floating-controls-gps.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add components/map/map-floating-controls.tsx tests/components/map/map-floating-controls.test.tsx tests/components/map-floating-controls-gps.test.tsx
git commit -m "feat: clarify map action dock hierarchy"
```

### Task 4: Wire grouped display data from the map container into the main map page

**Files:**
- Modify: `components/map/map-container.tsx`
- Modify: `tests/components/map/map-top-overlay.test.tsx`
- Optional Modify: `tests/components/map/map-page-client.test.tsx`

**Step 1: Write the failing test**

Add one contract test proving the display trigger now reflects grouped display information at the map-page integration layer.

```tsx
it("shows a display trigger that opens grouped map options", async () => {
  const user = userEvent.setup()

  render(<MapPageClient />)

  await user.click(await screen.findByRole("button", { name: "表示" }))

  expect(screen.getByText("表示する情報")).toBeInTheDocument()
  expect(screen.getByText("地図の見た目")).toBeInTheDocument()
})
```

If `MapPageClient` is too heavy for a stable component test, add a smaller integration test around [`components/map/map-container.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-container.tsx) or a render helper already used in this repo.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/map/map-top-overlay.test.tsx tests/components/map/map-floating-controls.test.tsx tests/components/map/map-page-client.test.tsx`

Expected: FAIL because `map-container` has not yet passed grouped overlay options into the display selector.

**Step 3: Write minimal implementation**

In [`components/map/map-container.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-container.tsx):

- build display-option data near the existing map state
- map the existing state to grouped display entries, for example:
  - `標準` => `streets-v12`
  - `衛星写真` => `satellite-v9`
  - `危険・注意` => `activeTopPanel === "hazard"` or the closest actual overlay state
  - `事故ヒートマップ` => `accidentHeatmap.isVisible`
- pass `isMobile` and `overlayOptions` into `MapFloatingControls` / `MapStyleSelector`

Suggested data shape:

```tsx
const mapOverlayOptions = [
  {
    id: "heatmap",
    label: "事故ヒートマップ",
    description: "事故の集中地点を重ねて表示します",
    selected: accidentHeatmap.isVisible,
    onSelect: accidentHeatmap.toggleVisibility,
  },
  {
    id: "hazard",
    label: "危険・注意",
    description: "通学路上の注意点を確認します",
    selected: activeTopPanel === "hazard",
    onSelect: () => setActiveTopPanel((current) => (current === "hazard" ? null : "hazard")),
  },
]
```

Do not invent overlays that the map does not already support. Match labels to real functionality in the current screen.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/map/map-style-selector.test.tsx tests/components/map/map-floating-controls.test.tsx tests/components/map-floating-controls-gps.test.tsx`

Expected: PASS, with grouped display options wired into the main map surface.

**Step 5: Commit**

```bash
git add components/map/map-container.tsx tests/components/map/map-top-overlay.test.tsx tests/components/map/map-page-client.test.tsx
git commit -m "feat: wire grouped map display options"
```

### Task 5: Verify responsive clarity and prevent layout regressions

**Files:**
- Modify: `tests/responsive/map-ui-layout.spec.ts`
- Optional Modify: `tests/components/map/map-style-selector.test.tsx`
- Optional Modify: `tests/components/map/map-floating-controls.test.tsx`

**Step 1: Write the failing test**

Add a responsive UI assertion that checks for the new explicit trigger and the clearer mobile action hierarchy.

```ts
test("mobile map shows the display trigger separately from primary actions", async ({ page }) => {
  await page.goto("/map")

  await expect(page.getByRole("button", { name: "表示" })).toBeVisible()
  await expect(page.getByRole("button", { name: "危険箇所を報告する" })).toBeVisible()
  await expect(page.getByRole("button", { name: "現在地で報告" })).toBeVisible()
})

test("display trigger opens grouped options on mobile", async ({ page }) => {
  await page.goto("/map")
  await page.getByRole("button", { name: "表示" }).click()

  await expect(page.getByText("表示する情報")).toBeVisible()
  await expect(page.getByText("地図に重ねる情報")).toBeVisible()
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm playwright test tests/responsive/map-ui-layout.spec.ts --project="Mobile Chrome - iPhone 12"`

Expected: FAIL before the final layout and trigger wiring are complete.

**Step 3: Write minimal implementation**

Make only the spacing and responsive polish needed to satisfy the tests:

- ensure the display trigger does not collide with the bottom action dock
- keep the bottom sheet fully readable above the mobile safe area
- preserve map accessibility and tap targets
- update snapshots if this spec is snapshot-driven in this repo

Manual verification checklist:

```text
1. Open /map on a mobile viewport.
2. Confirm the user can distinguish "表示" from the action dock at a glance.
3. Confirm "危険を報告" is the strongest CTA in the dock.
4. Confirm "現在地" still exposes the accessible name "現在地で報告".
5. Open "表示" and confirm grouped sections and selected-state labels appear.
6. Enter location selection and confirm the dock switches to a focused-state surface instead of disappearing ambiguously.
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/map/map-style-selector.test.tsx tests/components/map/map-floating-controls.test.tsx tests/components/map-floating-controls-gps.test.tsx`

Run: `pnpm playwright test tests/responsive/map-ui-layout.spec.ts --project="Mobile Chrome - iPhone 12"`

Run: `pnpm typecheck`

Expected: PASS. If the Playwright snapshot changed intentionally, update the expected snapshot in the same commit.

**Step 5: Commit**

```bash
git add tests/responsive/map-ui-layout.spec.ts tests/components/map/map-style-selector.test.tsx tests/components/map/map-floating-controls.test.tsx tests/components/map-floating-controls-gps.test.tsx
git commit -m "test: verify map selection UI clarity"
```
