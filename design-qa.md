# Map Hazard Marker Design QA

- Source visual truth: `.codex-artifacts/map-marker-audit-2026-07-17/05-selected-pin-concept.png`
- Implementation screenshot: `.codex-artifacts/map-marker-audit-2026-07-17/08-map-pin-implementation-zoomed.png`
- Full-view comparison: `.codex-artifacts/map-marker-audit-2026-07-17/09-source-implementation-comparison.png`
- Focused marker comparison: `.codex-artifacts/map-marker-audit-2026-07-17/10-marker-focused-comparison.png`
- Viewport: 1920 × 1080
- Route: `/map`
- State: demo user authenticated; cluster expanded once; standard 2D map

## Findings

No actionable P0, P1, or P2 differences remain.

- Marker shape and spacing: individual reports use a 36 × 42 px Lucide `MapPin` with a centered 15 × 15 px category icon. Browser measurements confirmed every category icon is fully contained within its marker.
- Cluster treatment: clusters use two overlapping pin icons and a centered count, matching the selected concept's stacked-pin affordance.
- Fonts and typography: the existing application typography and hierarchy are unchanged. Cluster count uses the existing UI weight and remains legible at map scale.
- Spacing and layout rhythm: header, search, filters, controls, map crop, and bottom actions remain unchanged. Marker anchoring moved to the pin tip so geographic positions remain accurate.
- Colors and visual tokens: danger severity continues to use `getDangerLevelPresentation`; the white keyline and controlled shadow match the selected concept and existing warm UI.
- Image quality and asset fidelity: all marker artwork uses the installed Lucide icon library; no raster placeholders, emoji, handcrafted SVG, or generated production assets were introduced.
- Copy and content: existing application copy is unchanged. Marker accessibility labels now identify the category and action in Japanese.

## Intentional Differences

- The generated concept contains illustrative extra markers and category colors that are not present in live data. The implementation preserves the actual report count and danger-severity colors instead of fabricating records or changing domain semantics.

## Interaction and Runtime Checks

- Individual marker click opens the report detail dialog.
- Enter on a focused marker opens the same dialog.
- Cluster click zooms in and separates the group.
- Marker focus rings and reduced-motion behavior are present.
- Console error and runtime error capture were enabled while opening and closing a report dialog; both remained empty.
- No visible clipping, icon overflow, or application error state was observed.

## Comparison History

### Pass 1

- Earlier findings: none at P0/P1/P2.
- Fixes made after comparison: none required.
- Post-fix evidence: not applicable; the first browser-rendered implementation passed.

## Follow-up Polish

- P3: a future usability study could compare 15 px and 16 px inner icons on lower-density mobile devices. This does not block the current desktop result.

final result: passed

## 2026-09-30 Revision: 「色つきの外形 + 白い丸 + 濃い色の絵」

Supersedes the marker shape, cluster treatment, and asset-fidelity findings above. User feedback after the pass above: the icons inside the map were still hard to understand.

- Root cause: Lucide `MapPin` carries an inner circle (r=3). Drawn with a white stroke it put a white ring directly behind the 15 px category icon, and the white icon had low contrast on the yellow/amber pins.
- Individual reports: 44 × 54 px teardrop from `lib/map/pin-shape.ts` (one handcrafted `<path>`, no inner ring), filled with the danger-level color, with a white disc and a 20 px category icon in ink color. This intentionally reverses the earlier "no handcrafted SVG" finding; category icons are still Lucide.
- Clusters: round count badge (`N件`) in the members' highest danger-level color, so clusters and single pins differ by shape.
- Shapes carry meaning: teardrop = report / circle = cluster / rounded square = route hazard (flood = cyan, tsunami = purple; neither collides with danger-level colors or the green report-location pin).
- Category icons come from `lib/map/danger-type-presentation.ts` for the pin, legend, sidebar, report wizard, detail modal and help dialog. Crime is `Siren` (was `Shield`), disaster is `CloudRainWind` (matches the wizard), other is `CircleAlert` (was `HelpCircle`).
- Text labels (`交通 ★★★☆`) appear under pins from zoom 16 (`PIN_LABEL_MIN_ZOOM`). A pin only gets a label when no other marker is within 110 px horizontally and 84 px vertically (`findPointsWithLabelRoom`), so labels never overlap each other or cover a neighboring pin.
- Legend: desktop shows category icons plus the danger-level color scale; mobile opens the full legend from a "ピンの見方" button.
- Evidence: Playwright (Chrome, 390 × 844 and 1366 × 768) against the dev server with fixture reports, at zoom 15 / 16 / 17 / 18. Not covered by screenshots: route hazard markers (no route with hazard data in the local environment) and satellite styles.
