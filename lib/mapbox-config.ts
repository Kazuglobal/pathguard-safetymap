/**
 * Mapbox configuration and token validation utilities
 */

import { mapboxRateLimiter } from './rate-limiter'
import { mapboxLogger } from './mapbox-logger'

let tokenValidationCache: {
  isValid: boolean
  timestamp: number
  error?: string
} | null = null

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export function getMapboxToken(): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  
  if (!token) {
    mapboxLogger.error('Mapbox access token is missing', {
      envVar: 'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN'
    })
    return null
  }

  if (!token.startsWith('pk.')) {
    mapboxLogger.error('Invalid Mapbox token format', {
      expectedPrefix: 'pk.',
      actualPrefix: token.substring(0, 3)
    })
    return null
  }

  return token
}

export function validateMapboxToken(): { isValid: boolean; error?: string } {
  const token = getMapboxToken()
  
  if (!token) {
    return { isValid: false, error: 'Token is missing or invalid format' }
  }

  return { isValid: true }
}

export async function validateMapboxTokenAsync(): Promise<{ isValid: boolean; error?: string; details?: any }> {
  // Check cache first
  if (tokenValidationCache && Date.now() - tokenValidationCache.timestamp < CACHE_DURATION) {
    return { 
      isValid: tokenValidationCache.isValid, 
      error: tokenValidationCache.error 
    }
  }

  const token = getMapboxToken()
  
  if (!token) {
    const result = { isValid: false, error: 'Token is missing or invalid format' }
    tokenValidationCache = { ...result, timestamp: Date.now() }
    return result
  }

  try {
    // Use rate limiting for API calls
    const tokenData = await mapboxRateLimiter.withRateLimit('token-validation', async () => {
      const tokenResponse = await fetch(`https://api.mapbox.com/tokens/v2?access_token=${token}`)
      
      if (!tokenResponse.ok) {
        if (tokenResponse.status === 429) {
          throw new Error('Rate limit exceeded for token validation')
        }
        throw new Error(`Token validation failed: HTTP ${tokenResponse.status}`)
      }

      return await tokenResponse.json()
    })
    
    if (tokenData.code !== 'TokenValid') {
      const error = `Token validation failed: ${tokenData.code || 'Unknown error'}`
      mapboxLogger.tokenValidationFailed(error, { tokenData })
      tokenValidationCache = { isValid: false, error, timestamp: Date.now() }
      return { isValid: false, error }
    }

    mapboxLogger.tokenValidationSuccess({ 
      user: tokenData.token?.user,
      usage: tokenData.token?.usage 
    })

    // Test access to the map styles we're using with rate limiting
    const styleTests = [
      'mapbox://styles/mapbox/streets-v12',
      'mapbox://styles/mapbox/streets-v11'
    ]

    for (const style of styleTests) {
      const styleId = style.replace('mapbox://styles/', '')
      
      await mapboxRateLimiter.withRateLimit(`style-${styleId}`, async () => {
        const styleResponse = await fetch(`https://api.mapbox.com/styles/v1/${styleId}?access_token=${token}`)
        
        if (!styleResponse.ok) {
          if (styleResponse.status === 429) {
            mapboxLogger.rateLimitExceeded(`styles/${styleId}`, { style })
            throw new Error('Rate limit exceeded for style access')
          }
          mapboxLogger.styleLoadFailed(style, `HTTP ${styleResponse.status}`)
          throw new Error(`Style access failed for ${style}: HTTP ${styleResponse.status}`)
        }

        mapboxLogger.styleLoadSuccess(style)
        
        return await styleResponse.json()
      })
    }

    // Test HTTPS requirement
    if (typeof window !== 'undefined' && window.location.protocol === 'http:') {
      const warning = 'Warning: Mapbox requires HTTPS in production. HTTP may cause token errors.'
      console.warn(warning)
    }

    tokenValidationCache = { isValid: true, timestamp: Date.now() }
    return { 
      isValid: true, 
      details: {
        user: tokenData.token?.user,
        usage: tokenData.token?.usage,
        authorization: tokenData.token?.authorization
      }
    }
  } catch (error) {
    const errorMessage = `Token validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    tokenValidationCache = { isValid: false, error: errorMessage, timestamp: Date.now() }
    return { isValid: false, error: errorMessage }
  }
}

export const MAPBOX_STYLES = {
  STREETS: 'mapbox://styles/mapbox/streets-v12',
  SATELLITE: 'mapbox://styles/mapbox/satellite-v9',
  OUTDOORS: 'mapbox://styles/mapbox/outdoors-v12',
  LIGHT: 'mapbox://styles/mapbox/light-v11',
  DARK: 'mapbox://styles/mapbox/dark-v11',
} as const

export const DEFAULT_MAPBOX_STYLE = MAPBOX_STYLES.STREETS

export function getMapboxStyle(style?: string): string {
  if (!style) return DEFAULT_MAPBOX_STYLE
  
  // If it's a full mapbox:// URL, return as-is
  if (style.startsWith('mapbox://')) return style
  
  // If it's a key from MAPBOX_STYLES, return the corresponding value
  const styleKey = style.toUpperCase() as keyof typeof MAPBOX_STYLES
  if (MAPBOX_STYLES[styleKey]) return MAPBOX_STYLES[styleKey]
  
  // Default fallback
  return DEFAULT_MAPBOX_STYLE
}