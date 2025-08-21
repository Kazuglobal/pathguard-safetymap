#!/usr/bin/env node

/**
 * Environment variable validation script
 * Run this during build to ensure all required environment variables are set
 */

// Load environment variables from .env.local if it exists
const fs = require('fs')
const path = require('path')

function loadEnvFile(envPath) {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const lines = envContent.split('\n')
    
    lines.forEach(line => {
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
  console.log('🔍 Validating environment variables...')
  
  const missing = []
  const invalid = []
  
  // Check required variables
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar]
    
    if (!value) {
      missing.push(envVar)
      continue
    }
    
    // Validate specific formats
    if (envVar === 'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN') {
      if (!value.startsWith('pk.')) {
        invalid.push(`${envVar} must start with 'pk.' (public token)`)
      }
    }
    
    if (envVar.includes('SUPABASE_URL')) {
      if (!value.startsWith('https://') || !value.includes('.supabase.co')) {
        invalid.push(`${envVar} must be a valid Supabase URL`)
      }
    }
    
    // (OPENAI_API_KEY is optional and validated below only if present)
  }
  
  // Report results
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:')
    missing.forEach(envVar => {
      console.error(`   - ${envVar}`)
    })
  }
  
  if (invalid.length > 0) {
    console.error('❌ Invalid environment variables:')
    invalid.forEach(error => {
      console.error(`   - ${error}`)
    })
  }
  
  if (missing.length === 0 && invalid.length === 0) {
    console.log('✅ All required environment variables are properly set!')
    
    // Check optional variables
    const missingOptional = optionalEnvVars.filter(envVar => !process.env[envVar])
    if (missingOptional.length > 0) {
      console.log('ℹ️  Optional environment variables not set:')
      missingOptional.forEach(envVar => {
        console.log(`   - ${envVar}`)
      })
    }

    // Validate optional OpenAI key format if provided
    const maybeOpenAIKey = process.env.OPENAI_API_KEY
    if (maybeOpenAIKey && !maybeOpenAIKey.startsWith('sk-')) {
      console.warn("⚠️  OPENAI_API_KEY is set but doesn't start with 'sk-'. OpenAI features may fail.")
    }
    
    return true
  }
  
  console.error('❌ Environment validation failed!')
  console.error('Please check your .env.local file and ensure all required variables are set.')
  console.error('See .env.example for reference.')
  
  return false
}

// Run validation
const isValid = validateEnvironmentVariables()

// Exit with error code if validation fails
if (!isValid) {
  process.exit(1)
}

module.exports = { validateEnvironmentVariables }