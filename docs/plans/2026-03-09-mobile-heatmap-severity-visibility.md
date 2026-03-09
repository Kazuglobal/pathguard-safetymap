# Mobile Heatmap Severity Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the mobile heatmap drawer show the fatal-only severity option as an always-visible control.

**Architecture:** Keep `AccidentHeatmapControls` as the single owner of heatmap filter UI. Split the severity field only: desktop retains the existing `Select`, while mobile renders a simple two-option segmented control that writes to the same `severityFilter` state.

**Tech Stack:** React, Next.js App Router, Tailwind CSS, Vitest, Testing Library

---

### Task 1: Add regression coverage for mobile severity visibility

**Files:**
- Modify: `tests/components/map/accident-heatmap-controls.test.tsx`

**Step 1: Write the failing test**

```tsx
it('shows the severity options directly in the mobile drawer', () => {
  render(
    <AccidentHeatmapControls
      filters={DEFAULT_HEATMAP_FILTERS}
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

  expect(screen.getByRole('button', { name: 'すべての事故' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '死亡事故のみ' })).toBeInTheDocument()
})

it('updates severity from the mobile inline control', () => {
  const onFiltersChange = vi.fn()

  render(
    <AccidentHeatmapControls
      filters={DEFAULT_HEATMAP_FILTERS}
      onFiltersChange={onFiltersChange}
      isVisible={true}
      onToggleVisibility={vi.fn()}
      isLoading={false}
      featureCount={128}
      error={null}
      isMobile={true}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: '事故ヒートマップ設定を開く' }))
  fireEvent.click(screen.getByRole('button', { name: '死亡事故のみ' }))

  expect(onFiltersChange).toHaveBeenCalledWith({ severityFilter: 'fatal' })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx`

Expected: FAIL because mobile still renders severity as a closed dropdown.

**Step 3: Write minimal implementation**

Add the tests only. Do not change production code yet.

**Step 4: Run test to verify it fails for the right reason**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx`

Expected: FAIL with missing mobile severity button assertions.

**Step 5: Commit**

```bash
git add tests/components/map/accident-heatmap-controls.test.tsx
git commit -m "test: cover mobile heatmap severity visibility"
```

### Task 2: Implement mobile inline severity controls

**Files:**
- Modify: `components/map/accident-heatmap-controls.tsx`
- Test: `tests/components/map/accident-heatmap-controls.test.tsx`

**Step 1: Write the failing test**

Use the tests from Task 1 as the active red state.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx`

Expected: FAIL before production changes.

**Step 3: Write minimal implementation**

Render a mobile-only two-option severity field:

```tsx
{isMobile ? (
  <div className="grid grid-cols-2 gap-2">
    <Button
      type="button"
      variant={filters.severityFilter === 'all' ? 'default' : 'outline'}
      onClick={() => onFiltersChange({ severityFilter: 'all' })}
    >
      すべての事故
    </Button>
    <Button
      type="button"
      variant={filters.severityFilter === 'fatal' ? 'default' : 'outline'}
      onClick={() => onFiltersChange({ severityFilter: 'fatal' })}
    >
      死亡事故のみ
    </Button>
  </div>
) : (
  <Select ... />
)}
```

Pass `isMobile` into the shared filter body and keep desktop behavior unchanged.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx`

Expected: PASS, including the new mobile severity assertions.

**Step 5: Commit**

```bash
git add components/map/accident-heatmap-controls.tsx tests/components/map/accident-heatmap-controls.test.tsx
git commit -m "fix: show mobile heatmap severity options inline"
```

### Task 3: Verify impacted UI stays green

**Files:**
- Test: `tests/components/map/accident-heatmap-controls.test.tsx`
- Test: `tests/components/map/map-floating-controls.test.tsx`

**Step 1: Run targeted verification**

Run: `npx vitest run tests/components/map/accident-heatmap-controls.test.tsx tests/components/map/map-floating-controls.test.tsx`

Expected: PASS.

**Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 3: Commit**

```bash
git add components/map/accident-heatmap-controls.tsx tests/components/map/accident-heatmap-controls.test.tsx
git commit -m "chore: verify mobile heatmap severity fix"
```
