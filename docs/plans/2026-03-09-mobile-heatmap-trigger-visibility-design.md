# Mobile Heatmap Trigger Visibility Design

**Problem:** On mobile, the heatmap trigger is hidden whenever `awaitingLocationSelection` is true, even though the map itself is still the active surface. Users therefore lose access to the heatmap drawer in normal map usage.

**Decision:** Keep hiding the trigger only while the full-screen mobile report form is open. During ordinary mobile map usage, including location-selection mode, keep the trigger rendered.

**Why this approach:**
- It matches the user's expectation that the heatmap entry point should always exist on the map screen.
- It avoids reopening the trigger over the full-screen report form.
- It limits scope to the visibility gate in `MapContainer`.

**Validation:**
- Add a regression test for the visibility helper proving mobile still shows the trigger during location selection.
- Keep the existing overlay-z-order assertion intact.
