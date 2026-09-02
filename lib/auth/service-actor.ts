import 'server-only'

import type { Actor } from '@/lib/db/authz'

const SERVICE_ACTOR: Actor = Object.freeze({ kind: 'service' })

export function getServiceActor(): Actor {
  return SERVICE_ACTOR
}
