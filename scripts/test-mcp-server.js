#!/usr/bin/env node

/**
 * Test script to verify MCP server functionality
 */

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

// Load environment variables
function loadEnvFile(envPath) {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const lines = envContent.split('\n')
    
    lines.forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=')
        const value = valueParts.join('=').trim()
        if (key && value) {
          process.env[key.trim()] = value
        }
      }
    })
  }
}

loadEnvFile(path.join(process.cwd(), '.env.local'))
loadEnvFile(path.join(process.cwd(), '.env'))

async function testMCPServer() {
  console.log('🧪 Testing MCP Server Configuration...\n')
  
  // Test 1: Check configuration files exist
  console.log('1. Checking MCP configuration files...')
  
  const configFiles = [
    'claude_desktop_config.json',
    '.clauderc'
  ]
  
  let configFound = false
  for (const file of configFiles) {
    const filePath = path.join(process.cwd(), file)
    if (fs.existsSync(filePath)) {
      console.log(`✅ Configuration file found: ${file}`)
      configFound = true
      
      // Validate configuration structure
      try {
        const config = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        if (config.mcpServers && (config.mcpServers.MapboxServer || config.mcpServers.mapbox)) {
          const serverConfig = config.mcpServers.MapboxServer || config.mcpServers.mapbox
          console.log('✅ Valid MCP configuration structure')
          console.log(`   Command: ${serverConfig.command}`)
          console.log(`   Package: ${serverConfig.args.join(' ')}`)
        } else {
          console.log('❌ Invalid MCP configuration structure')
        }
      } catch (error) {
        console.log(`❌ Invalid JSON in ${file}: ${error.message}`)
      }
    }
  }
  
  if (!configFound) {
    console.log('❌ No MCP configuration files found')
    return false
  }
  
  // Test 2: Check environment variables
  console.log('\n2. Checking environment variables...')
  
  const requiredEnvVars = [
    'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN',
    'MAPBOX_ACCESS_TOKEN'
  ]
  
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar]
    if (!value) {
      console.log(`❌ Missing environment variable: ${envVar}`)
      return false
    }
    
    if (!value.startsWith('pk.')) {
      console.log(`❌ Invalid token format for ${envVar}`)
      return false
    }
    
    console.log(`✅ Environment variable set: ${envVar}`)
    console.log(`   Value: ${value.substring(0, 10)}...`)
  }
  
  // Test 3: Test Mapbox MCP server package availability
  console.log('\n3. Testing Mapbox MCP server package...')
  
  try {
    const result = await new Promise((resolve, reject) => {
      // Use 'cmd' on Windows to properly execute npx
      const isWindows = process.platform === 'win32'
      const command = isWindows ? 'cmd' : 'npx'
      const args = isWindows ? ['/c', 'npx', '-y', '@mapbox/mcp-server', '--help'] : ['-y', '@mapbox/mcp-server', '--help']
      
      const child = spawn(command, args, {
        stdio: 'pipe',
        env: { ...process.env, MAPBOX_ACCESS_TOKEN: process.env.MAPBOX_ACCESS_TOKEN }
      })
      
      let stdout = ''
      let stderr = ''
      
      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      child.on('close', (code) => {
        resolve({ code, stdout, stderr })
      })
      
      child.on('error', (error) => {
        reject(error)
      })
      
      // Kill the process after 30 seconds
      setTimeout(() => {
        child.kill()
        reject(new Error('Process timeout'))
      }, 30000)
    })
    
    if (result.code === 0 || result.stdout.includes('Usage') || result.stderr.includes('Usage')) {
      console.log('✅ @mapbox/mcp-server package is available')
      console.log('✅ MCP server can be started')
    } else {
      console.log('❌ @mapbox/mcp-server package test failed')
      console.log(`   Exit code: ${result.code}`)
      console.log(`   Stdout: ${result.stdout}`)
      console.log(`   Stderr: ${result.stderr}`)
    }
    
  } catch (error) {
    console.log(`❌ Error testing MCP server: ${error.message}`)
    return false
  }
  
  // Test 4: Validate token with Mapbox API
  console.log('\n4. Validating token with Mapbox API...')
  
  const token = process.env.MAPBOX_ACCESS_TOKEN
  
  try {
    const response = await fetch(`https://api.mapbox.com/tokens/v2?access_token=${token}`)
    
    if (!response.ok) {
      console.log(`❌ Token validation failed: HTTP ${response.status}`)
      return false
    }
    
    const data = await response.json()
    console.log('✅ Token validation successful')
    console.log(`   User: ${data.token?.user}`)
    console.log(`   Usage: ${data.token?.usage}`)
    
  } catch (error) {
    console.log(`❌ Token validation error: ${error.message}`)
    return false
  }
  
  console.log('\n🎉 MCP Server configuration test completed successfully!')
  console.log('\nNext steps:')
  console.log('1. Restart Claude Desktop to load the new MCP configuration')
  console.log('2. Verify MCP server appears in Claude Desktop settings')
  console.log('3. Test MCP server functionality within Claude')
  console.log('4. Use MCP server for Mapbox operations')
  
  return true
}

testMCPServer().catch(error => {
  console.error('❌ MCP Server test failed:', error)
  process.exit(1)
})