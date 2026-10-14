# Repository instructions

Read CLAUDE.md for repository security rules.

## Production deployments

Production publishes must run through the Cloudflare Production GitHub Actions workflow on main. Do not publish from a local checkout, reuse an old build, roll back production, deploy Worker versions, or mutate production Worker secrets through Wrangler. Such actions require a separate explicit user instruction naming the target and reason. Implement fixes on the latest main, use a PR, and verify the CI result and live behavior.

Read-only deployment/log inspection, dry runs, and isolated previews are allowed. Do not bypass the production source guard by spoofing GitHub Actions environment variables.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
