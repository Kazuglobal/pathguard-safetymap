import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache'

// Cloudflare Workers Paid allows up to 10 MiB compressed scripts, so the entire
// Next.js app runs in a single Worker without manual route splitting.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
})
