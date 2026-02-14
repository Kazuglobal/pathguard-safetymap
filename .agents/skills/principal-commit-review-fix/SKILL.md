---
name: principal-commit-review-fix
description: Principal-engineer style commit review and remediation workflow. Use this skill when users ask to review a specific commit or PR with severity-ranked findings and also want confirmed issues fixed in the same flow, such as "コミットをレビューして" or "指摘があれば修正して".
---

# Principal Commit Review Fix

Run a strict, senior-level review first. Prioritize correctness, regression risk, and missing test coverage. Implement fixes only for validated findings.

## Workflow

1. Confirm scope.
- Identify exact target: commit SHA, branch, or PR.
- Confirm whether the user wants review-only or review-plus-fix.

2. Inspect the change.
- Run `git show --stat --patch <sha>` for commit reviews.
- Read full context in touched files, not just diff hunks.
- Search for impacted tests and related call sites.

3. Produce review findings.
- List findings first, ordered by severity: `Critical`, `High`, `Medium`, `Low`.
- Include impact, concrete evidence, and file references (`path:line`).
- If no findings exist, state that explicitly.
- Call out residual risks and test gaps.

4. Decide fix execution.
- If the request includes fixing (for example, "指摘を修正"), implement directly.
- If behavior changes are ambiguous or high-risk, ask before changing semantics.

5. Implement fixes.
- Make the smallest safe change.
- Avoid unrelated refactors.
- Preserve accessibility and localization behavior.
- Add or update tests that lock the fix.

6. Validate.
- Run the narrowest meaningful tests first.
- Report unrelated pre-existing failures separately from the fix result.

7. Close out.
- Summarize findings, applied fixes, validation results, and any remaining risks.
- Proceed to commit/PR actions only when the user asks.

## Review Checklist

- Behavioral correctness and regressions
- Edge cases and state transitions
- Accessibility (`aria-*`, keyboard, semantics)
- Responsive layout (overflow, clipping, wrapping)
- Type/runtime safety
- Test coverage for changed behavior
- Maintainability and duplication

## Output Contract

Use this structure for responses:

1. `Findings` (required, severity-ordered, with file references)
2. `Open Questions / Assumptions` (only when needed)
3. `Validation` (commands and pass/fail summary)
4. `Change Summary` (only after findings/fixes)
