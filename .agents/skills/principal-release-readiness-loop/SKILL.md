---
name: principal-release-readiness-loop
description: Principal-engineer release-readiness workflow that iterates review and fixes until publishable quality is reached. Use when users ask for repeated strict review, issue remediation, and final PR creation or update, such as "fix until release ready", "repeat review and remediation", or "review and fix loop with PR".
---

# Principal Release Readiness Loop

Run a strict review-fix loop until the change is publish-ready.
Treat unresolved High or Medium risks as blockers.

## Workflow

1. Confirm scope.
- Identify target (commit, branch, or PR) and output (review only, review plus fix, PR create or update).
- Define release gate: no unresolved High or Medium, test evidence attached, and user acceptance criteria met.

2. Execute review pass.
- Read full touched files, not only diff hunks.
- Review with five lenses:
  - Security (injection, authz or authn, data exposure)
  - Performance (N+1, redundant fetch or render, payload bloat)
  - Maintainability (readability, coupling, duplication, naming)
  - Edge cases (null, empty, invalid input, concurrency)
  - YAGNI (over-design vs requirement)
- Rate each lens with OK or WARN.

3. Publish findings.
- List findings first, ordered by severity (Critical, High, Medium, Low).
- Include impact, concrete evidence, and file refs (path:line).
- If no findings, state that and call out residual risks or test gaps.

4. Apply fixes.
- Fix only validated findings.
- Prefer smallest safe changes and avoid unrelated refactors.
- Preserve behavior unless change is required for correctness or safety.
- Add or update focused tests for each fixed bug class.

5. Re-review after fixes.
- Re-run the same five-lens review.
- Re-check whether previous findings are closed.
- Repeat steps 3 to 5 until all lenses are OK or only accepted Low residual risk remains.

6. Validate and ship.
- Run narrow tests first, then impacted suite.
- Report commands and pass or fail counts.
- When asked to ship:
  - Commit only intended files.
  - Push branch.
  - If PR exists, update it.
  - If no PR exists, create one with summary, risks, and validation evidence.

## Output Contract

1. Findings (severity-ordered, include lens tags and refs)
2. Five-Lens Verdict (items 1 to 5 each with OK or WARN)
3. Validation (commands plus results)
4. Change Summary (what changed and why)
5. PR Status (created or updated, with URL)
