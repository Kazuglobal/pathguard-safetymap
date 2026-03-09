# Mobile Heatmap Severity Visibility Design

**Problem:** On mobile, the heatmap drawer hides the severity choice behind a nested select, so users do not notice that `死亡事故のみ` exists.

**Decision:** Keep the desktop `Select` unchanged. On mobile only, replace the severity control with an always-visible two-option segmented control inside the drawer: `すべての事故` and `死亡事故のみ`.

**Why this approach:**
- It makes the fatal-only option visible without requiring a second tap.
- It avoids drawer-plus-select overlay quirks on mobile.
- It limits scope to one filter field and preserves the existing filter state shape.

**Behavior:**
- Mobile drawer shows two inline buttons for severity.
- Tapping a button updates `filters.severityFilter`.
- Desktop continues using the existing select dropdown.

**Validation:**
- Add a regression test proving the mobile drawer shows both severity options directly.
- Add a regression test proving tapping `死亡事故のみ` sends `{ severityFilter: 'fatal' }`.
