#!/usr/bin/env node

/**
 * Test script to verify Mapbox integration with new token
 */

const fs = require('fs')
const path = require('path')

// Load environment variables
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

loadEnvFile(path.join(process.cwd(), '.env.local'))

async function testMapboxIntegration() {
  console.log('🧪 Testing Mapbox Integration...\n')
  
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  
  if (!token) {
    console.error('❌ NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is not set')
    process.exit(1)
  }
  
  if (!token.startsWith('pk.')) {
    console.error('❌ Invalid token format - must start with pk.')
    process.exit(1)
  }
  
  console.log('✅ Token format is valid')
  console.log(`📝 Token prefix: ${token.substring(0, 10)}...`)
  
  // Test 1: Token validation
  console.log('\n1. Testing token validation...')
  try {
    const response = await fetch(`https://api.mapbox.com/tokens/v2?access_token=${token}`)
    
    if (!response.ok) {
      console.error(`❌ Token validation failed: HTTP ${response.status}`)
      process.exit(1)
    }
    
    const data = await response.json()
    console.log('✅ Token validation successful')
    console.log(`   User: ${data.token?.user}`)
    console.log(`   Usage: ${data.token?.usage}`)
    
  } catch (error) {
    console.error(`❌ Token validation error: ${error.message}`)
    process.exit(1)
  }
  
  // Test 2: Style access
  console.log('\n2. Testing style access...')
  const styles = [
    'mapbox://styles/mapbox/streets-v12',
    'mapbox://styles/mapbox/streets-v11'
  ]
  
  for (const style of styles) {
    const styleId = style.replace('mapbox://styles/', '')
    try {
      const response = await fetch(`https://api.mapbox.com/styles/v1/${styleId}?access_token=${token}`)
      
      if (!response.ok) {
        console.error(`❌ Style access failed for ${style}: HTTP ${response.status}`)
        process.exit(1)
      }
      
      console.log(`✅ Style access successful: ${style}`)
      
    } catch (error) {
      console.error(`❌ Style access error for ${style}: ${error.message}`)
      process.exit(1)
    }
  }
  
  // Test 3: Check file existence
  console.log('\n3. Testing file structure...')
  const requiredFiles = [
    'lib/mapbox-config.ts',
    'lib/mapbox-logger.ts',
    'lib/rate-limiter.ts',
    'components/map/mapbox-error-boundary.tsx',
    'app/api/debug/mapbox/route.ts'
  ]
  
  for (const file of requiredFiles) {
    const filePath = path.join(process.cwd(), file)
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Missing file: ${file}`)
      process.exit(1)
    }
    console.log(`✅ File exists: ${file}`)
  }
  
  // Test 4: Component files
  console.log('\n4. Testing component files...')
  const componentFiles = [
    'components/map/map-container.tsx',
    'components/map/school-traffic-viewer.tsx',
    'components/map/map-wrapper.tsx'
  ]
  
  for (const file of componentFiles) {
    const filePath = path.join(process.cwd(), file)
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Missing component file: ${file}`)
      process.exit(1)
    }
    
    const content = fs.readFileSync(filePath, 'utf8')
    if (content.includes('NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN')) {
      console.log(`✅ Component uses correct token: ${file}`)
    } else {
      console.log(`⚠️  Component may need token update: ${file}`)
    }
  }
  
  console.log('\n🎉 All tests passed! Mapbox integration is working correctly.')
  console.log('\nNext steps:')
  console.log('1. Deploy the application to production')
  console.log('2. Test the debug endpoint: /api/debug/mapbox')
  console.log('3. Monitor the application logs for any issues')
  console.log('4. Verify all map components load correctly')
}

testMapboxIntegration().catch(error => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})