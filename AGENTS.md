# Repository instructions

Read CLAUDE.md for repository security rules.

## Production deployments

Production publishes must run through the Cloudflare Production GitHub Actions workflow on main. Do not publish from a local checkout, reuse an old build, roll back production, deploy Worker versions, or mutate production Worker secrets through Wrangler. Such actions require a separate explicit user instruction naming the target and reason. Implement fixes on the latest main, use a PR, and verify the CI result and live behavior.

Read-only deployment/log inspection, dry runs, and isolated previews are allowed. Do not bypass the production source guard by spoofing GitHub Actions environment variables.
