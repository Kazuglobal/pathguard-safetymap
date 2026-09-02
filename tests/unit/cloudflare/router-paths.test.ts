import { describe, expect, it } from 'vitest'

import { routeBindingForPath } from '../../../cloudflare/router-paths'

describe('Cloudflare router path dispatch', () => {
  it('dispatches the disabled debug-env endpoint to the guarded auth worker', () => {
    expect(routeBindingForPath('/api/debug-env')).toBe('AUTH_ADMIN')
  })

  it('keeps prefix matching on path-segment boundaries', () => {
    expect(routeBindingForPath('/api/debug/mapbox')).toBe('AUTH_ADMIN')
    expect(routeBindingForPath('/api/debugger')).toBe('CORE')
  })
})
