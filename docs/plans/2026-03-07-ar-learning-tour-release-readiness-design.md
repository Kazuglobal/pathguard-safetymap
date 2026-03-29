# AR Learning Tour Release Readiness Design

**Goal:** Keep AR learning-tour progress stable across viewport changes and always advance to the next unfinished stop.

## Context

Commit `16f78b7` introduces learning-tour state inside `ARView`. The initial implementation ties `tourProgress` to `arHazards`, which is a visibility-filtered and distance-sorted view of reports. That makes the tour state unstable whenever the visible subset changes or reorders.

## Design

- Treat `tourProgress` as session-scoped state keyed by `report.id`.
- Do not prune `tourProgress` from `arHazards`; only clear it when the user explicitly restarts the tour or closes AR.
- When a stop is marked `reviewed` or `saved`, compute the next active stop from the full current `learningStops` list after applying the new status, not only from stops after the current index.
- Add focused regression tests for:
  - progress surviving a temporary visibility drop
  - next-stop selection still finding an unfinished stop after the list reorders

## Risk Notes

- The fix should stay local to `ARView`; no schema or API changes are needed.
- Test coverage needs to exercise the state transitions directly because no existing `ARView` tests cover them.
