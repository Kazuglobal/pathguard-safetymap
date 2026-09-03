# Hazard Marker Icon-Only Refresh — Design QA

- Source visual truth: `.codex-artifacts/hazard-marker-icon-refresh-2026-07-19/source-option-3.png`
- Implementation screenshot: `.codex-artifacts/hazard-marker-icon-refresh-2026-07-19/implementation-desktop-final.png`
- Full-view comparison evidence: `.codex-artifacts/hazard-marker-icon-refresh-2026-07-19/source-implementation-comparison-final.png`
- Focused marker comparison evidence: `.codex-artifacts/hazard-marker-icon-refresh-2026-07-19/marker-focused-comparison-final.png`
- Viewport: 1280 × 720
- Route: `/map`
- State: authenticated user; 2D map centered near Kashiwa at zoom 14; two individual reports and three clusters visible

## Findings

No actionable P0, P1, or P2 differences remain.

- Icons: individual reports use a large Lucide category pictogram inside a category-colored pin. Traffic, crime, disaster, suspicious-person, and other states have distinct icons and colors; the implementation does not put category or severity text inside the marker.
- Severity: danger level is visible without text through one to four concentric icon-library rings. The browser-rendered level-3 reports contained exactly three rings.
- Clusters: the cream cluster pin shows a large count and up to three category icon tabs, preserving the selected concept's multi-category cluster affordance.
- Fonts and typography: application typography, navigation, search, control labels, and hierarchy are unchanged. The only new visible text is the cluster count, set at a legible 16 px / 900 weight.
- Spacing and layout rhythm: the existing header, search, overlay controls, map crop, and primary actions remain unchanged. Individual markers use a 76 × 68 px interaction box with a 48 × 56 px pin, aligned to the geographic point by its bottom anchor.
- Colors and visual tokens: category colors are separated from severity: blue traffic, red crime, orange disaster, magenta suspicious-person, and slate other. White keylines and restrained shadows match the selected visual and existing warm paper UI.
- Image quality and asset fidelity: marker artwork uses the installed Lucide icon library. No raster placeholder, emoji, handcrafted SVG, inline SVG, or CSS-drawn pictogram was introduced.
- Copy and content: visible application copy is unchanged. Accessible names add the category, review state, danger level, and action in Japanese.
- Accessibility and behavior: markers remain buttons with keyboard activation and visible focus treatment; reduced-motion rules remain active. The larger interaction box exceeds a 44 px pointer target.
- Responsiveness: the marker footprint remains bounded and Mapbox clustering reduces overlap at lower zoom. Existing mobile/desktop control layouts were not changed.

## Intentional Differences

- Live data determines which category icons are visible, so the implementation screenshot shows the available disaster reports rather than fabricating the full category mix shown in the generated concept.
- The implementation uses complete concentric rings instead of partially clipped side arcs. This keeps the severity count equally readable against map features on any side of the pin and avoids directional ambiguity; the overall icon-only hierarchy remains faithful.

## Interaction and Runtime Checks

- Individual marker click opened the report detail view.
- Existing keyboard activation remains covered by the marker hook and unit test.
- Zooming produced two individual markers and three clusters at the comparison state.
- A fresh browser run showed no console errors after location search, zoom, marker redraw, and detail opening.
- Targeted unit test passed: `tests/unit/hooks/use-danger-markers.test.tsx`.
- TypeScript check passed: `npm run typecheck`.

## Comparison History

### Pass 1

- [P2] Category pictogram was optically smaller than the selected source at normal map scale.
  - Fix: increased the icon from 23 px to 27 px and moved it upward by 2 px inside the pin.
- [P2] Zoom redraw emitted synchronous React-root unmount errors in the browser console.
  - Fix: deferred root cleanup to a microtask and updated the cleanup test to assert the asynchronous lifecycle.
- Evidence: initial implementation screenshot and full-view comparison in the same artifact folder.

### Pass 2

- Earlier P2 findings were resolved.
- Post-fix browser evidence shows 2 markers, 3 clusters, three severity rings on each level-3 report, working report detail opening, and an empty console error list.
- Full-view and focused comparisons show no remaining P0/P1/P2 mismatch.

## Follow-up Polish

- P3: user testing may determine whether complete rings or source-style partial arcs scan faster on very dense maps. This does not block the current icon-only design.

final result: passed
