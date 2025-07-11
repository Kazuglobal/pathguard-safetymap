/**
 * Rate limiter for API calls
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map()
  private maxRequests: number
  private windowMs: number

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  async checkLimit(key: string): Promise<{ allowed: boolean; remainingRequests: number; resetTime: number }> {
    const now = Date.now()
    const entry = this.limits.get(key)

    if (!entry || now > entry.resetTime) {
      // Reset or initialize the limit
      this.limits.set(key, {
        count: 1,
        resetTime: now + this.windowMs
      })
      return {
        allowed: true,
        remainingRequests: this.maxRequests - 1,
        resetTime: now + this.windowMs
      }
    }

    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: entry.resetTime
      }
    }

    entry.count++
    return {
      allowed: true,
      remainingRequests: this.maxRequests - entry.count,
      resetTime: entry.resetTime
    }
  }

  async withRateLimit<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const limit = await this.checkLimit(key)
    
    if (!limit.allowed) {
      const waitTime = limit.resetTime - Date.now()
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`)
    }

    return await fn()
  }

  cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key)
      }
    }
  }
}

// Global rate limiter instances
export const mapboxRateLimiter = new RateLimiter(100, 60000) // 100 requests per minute
export const apiRateLimiter = new RateLimiter(500, 60000) // 500 requests per minute for general API

// Cleanup old entries every 5 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    mapboxRateLimiter.cleanup()
    apiRateLimiter.cleanup()
  }, 5 * 60 * 1000)
}