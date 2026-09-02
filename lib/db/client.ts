import { getCloudflareContext } from '@opennextjs/cloudflare'
import { drizzle } from 'drizzle-orm/d1'

import * as schema from './schema'

type D1Binding = Parameters<typeof drizzle>[0]

export type AppDb = ReturnType<typeof drizzle<typeof schema>>

export function getDb(): AppDb {
  const context = getCloudflareContext()
  const env = context.env as unknown as { DB: D1Binding }
  return drizzle(env.DB, { schema })
}

export function getTrafficDb(): AppDb {
  const context = getCloudflareContext()
  const env = context.env as unknown as { TRAFFIC_DB: D1Binding }
  return drizzle(env.TRAFFIC_DB, { schema })
}
