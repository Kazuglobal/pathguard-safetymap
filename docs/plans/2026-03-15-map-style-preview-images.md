# Map Style Preview Images Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add clear preview images to all seven map style options in the `表示する情報` UI so users can quickly understand each base map appearance.

**Architecture:** Keep [`components/map/map-style-selector.tsx`](C:/Users/s1598/mapsefe/20250615/components/map/map-style-selector.tsx) as the owner of map style presentation data, extend each style definition with a local preview asset, and render a compact thumbnail inside each style card. Store the preview assets as static SVG files under `public` so the UI stays fast, deterministic, and testable without runtime map requests.

**Tech Stack:** Next.js App Router, React 19, Next Image, Tailwind CSS, Vitest, Testing Library

---

### Task 1: Lock the new image requirement with a failing component test

**Files:**
- Modify: `tests/components/map/map-style-selector.test.tsx`
- Test: `components/map/map-style-selector.tsx`

**Step 1: Write the failing test**

Add a test that opens the display UI and asserts all seven map style options render a preview image with clear alt text.

```tsx
it("shows preview images for all map styles in the display UI", async () => {
  const user = userEvent.setup()

  render(
    <MapStyleSelector
      currentStyle="streets-v12"
      onChange={() => {}}
      isMobile
      buttonLabel="表示"
      overlayOptions={[
        {
          id: "heatmap",
          label: "事故ヒートマップ",
          description: "事故の集中地点を表示",
          selected: false,
          onSelect: vi.fn(),
        },
      ]}
    />,
  )

  await user.click(screen.getByRole("button", { name: "表示" }))

  expect(screen.getByRole("img", { name: "標準のプレビュー" })).toBeInTheDocument()
  expect(screen.getByRole("img", { name: "衛星写真のプレビュー" })).toBeInTheDocument()
  expect(screen.getAllByRole("img")).toHaveLength(7)
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/map/map-style-selector.test.tsx`

Expected: FAIL because the current selector renders text-only style cards.

**Step 3: Write minimal implementation**

Extend the map style metadata with local preview asset paths and render the preview thumbnail in each style card.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/map/map-style-selector.test.tsx`

Expected: PASS with the new preview-image assertions green.

### Task 2: Add static preview assets for all seven styles

**Files:**
- Create: `public/images/map-style-previews/streets-v12.svg`
- Create: `public/images/map-style-previews/satellite-v9.svg`
- Create: `public/images/map-style-previews/satellite-streets-v12.svg`
- Create: `public/images/map-style-previews/navigation-day-v1.svg`
- Create: `public/images/map-style-previews/light-v11.svg`
- Create: `public/images/map-style-previews/dark-v11.svg`
- Create: `public/images/map-style-previews/outdoors-v12.svg`

**Step 1: Create the image assets**

Author seven square SVG thumbnails that exaggerate the visual differences between styles:

- `標準`: roads and water on a light map
- `衛星写真`: aerial textures
- `衛星+道路`: aerial textures plus road labels/lines
- `ナビ`: bold route lines on a clear road map
- `ライト`: pale minimal map
- `ダーク`: dark background with high-contrast roads
- `アウトドア`: contour-heavy terrain map

**Step 2: Verify assets are present**

Run: `Get-ChildItem public/images/map-style-previews`

Expected: all seven SVG files listed.

### Task 3: Refine card layout without regressing selection clarity

**Files:**
- Modify: `components/map/map-style-selector.tsx`
- Test: `tests/components/map/map-style-selector.test.tsx`

**Step 1: Render image + text layout**

Keep the existing title, description, and `表示中` state, but add a thumbnail block so the option remains understandable even before reading the description.

**Step 2: Re-run the component test**

Run: `pnpm vitest run tests/components/map/map-style-selector.test.tsx`

Expected: PASS with existing grouped-content assertions still green.

**Step 3: Commit**

```bash
git add docs/plans/2026-03-15-map-style-preview-images.md tests/components/map/map-style-selector.test.tsx components/map/map-style-selector.tsx public/images/map-style-previews
git commit -m "feat: add map style preview images"
```
