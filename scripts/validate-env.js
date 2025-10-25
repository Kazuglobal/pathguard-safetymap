#!/usr/bin/env node

/**
 * Environment variable validation script
 * Run this during build to ensure all required environment variables are set.
 */

const fs = require('fs')
const path = require('path')

const defaultsPath = path.join(process.cwd(), 'env.defaults.json')
let envDefaults = {}

try {
  if (fs.existsSync(defaultsPath)) {
    const rawDefaults = fs.readFileSync(defaultsPath, 'utf8')
    envDefaults = JSON.parse(rawDefaults)
  }
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error)
  console.warn('[env] Failed to read env.defaults.json:', reason)
  envDefaults = {}
}

// Load environment variables from .env.local/.env if they exist
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return

  const envContent = fs.readFileSync(envPath, 'utf8')
  const lines = envContent.split('\n')

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=')
      const value = valueParts.join('=')
      if (key && value && !process.env[key]) {
        process.env[key] = value
      }
    }
  })
}

// Load .env.local first, then .env
loadEnvFile(path.join(process.cwd(), '.env.local'))
loadEnvFile(path.join(process.cwd(), '.env'))

const requiredEnvVars = [
  'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]

const optionalEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  // OpenAI is optional at build time. Related features will be disabled if absent.
  'OPENAI_API_KEY',
]

function validateEnvironmentVariables() {
  console.log('[env] Validating environment variables...')

  const missing = []
  const invalid = []
  const usedFallbacks = []

  // Check required variables
  for (const envVar of requiredEnvVars) {
    const rawValue = process.env[envVar]
    const fallbackValue = envDefaults[envVar]
    const value = rawValue || fallbackValue
    const isUsingFallback = !rawValue && !!fallbackValue

    if (!value) {
      missing.push(envVar)
      continue
    }

    if (isUsingFallback) {
      usedFallbacks.push(envVar)
      process.env[envVar] = value
    }

    // Validate specific formats
    if (envVar === 'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN' && !value.startsWith('pk.')) {
      invalid.push(`${envVar} must start with 'pk.' (public token)`)
    }

    if (envVar.includes('SUPABASE_URL')) {
      if (!value.startsWith('https://') || !value.includes('.supabase.co')) {
        invalid.push(`${envVar} must be a valid Supabase URL`)
      }
    }
  }

  // Report results
  if (missing.length > 0) {
    console.error('[env] Missing required environment variables:')
    missing.forEach((envVar) => {
      console.error(`   - ${envVar}`)
    })
  }

  if (invalid.length > 0) {
    console.error('[env] Invalid environment variables:')
    invalid.forEach((error) => {
      console.error(`   - ${error}`)
    })
  }

  if (missing.length === 0 && invalid.length === 0) {
    console.log('[env] All required environment variables are available.')

    // Check optional variables
    const missingOptional = optionalEnvVars.filter((envVar) => {
      const raw = process.env[envVar]
      const fallback = envDefaults[envVar]
      return !(raw || fallback)
    })
    if (missingOptional.length > 0) {
      console.log('[env] Optional environment variables not set:')
      missingOptional.forEach((envVar) => {
        console.log(`   - ${envVar}`)
      })
    }

    // Validate optional OpenAI key format if provided
    const maybeOpenAIKey = process.env.OPENAI_API_KEY
    if (maybeOpenAIKey && !maybeOpenAIKey.startsWith('sk-')) {
      console.warn("[env] OPENAI_API_KEY is set but doesn't start with 'sk-'. OpenAI features may fail.")
    }

    if (usedFallbacks.length > 0) {
      console.warn('[env] Using fallback values from env.defaults.json for:')
      usedFallbacks.forEach((envVar) => {
        console.warn(`   - ${envVar}`)
      })
      console.warn('[env] Define these variables in your deployment environment to use project-specific credentials.')
    }

    return true
  }

  console.error('[env] Environment validation failed!')
  console.error('Please check your .env.local file and ensure all required variables are set.')
  console.error('See env.defaults.json or your deployment settings for reference.')

  return false
}

// Run validation
const isValid = validateEnvironmentVariables()

// Exit with error code if validation fails
if (!isValid) {
  process.exit(1)
}

module.exports = { validateEnvironmentVariables }
