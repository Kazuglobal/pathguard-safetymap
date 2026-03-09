# Landing Report Reactions Race Fix Design

**Context**

`useLandingReportReactions` persists landing-page reactions to Supabase, but it currently has two client-side race conditions:

1. The initial `SELECT` can overwrite an optimistic toggle performed before the first load finishes.
2. Rapid repeated clicks can issue conflicting writes from stale closure state and leave UI and DB out of sync.

**Recommended Approach**

Keep the current hook-based client design and fix the concurrency issues locally.

- Track whether the initial reaction load has completed.
- Track in-flight toggles per `reportId:reactionType` key and ignore duplicate clicks while one write is pending.
- Merge the initial fetch result into current state instead of replacing local optimistic changes blindly.
- Preserve optimistic updates and revert only the affected key on write failure.
- Align the new migration's RLS predicates with the repo's `(SELECT auth.uid())` policy style.

**Why This Approach**

- Smallest safe change for the existing architecture.
- Fixes the validated High and Medium findings without introducing RPCs or wider schema changes.
- Keeps the current UX responsive.
- Can be covered with focused unit tests around the hook.

**Testing Strategy**

- Add a test that clicks before the initial load resolves and verifies the optimistic state survives the late fetch.
- Add a test that fires two rapid toggles and verifies only one write proceeds for the same reaction key.
- Keep existing component tests to verify button wiring remains intact.
