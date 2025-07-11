# Mapbox MCP Server Setup Guide

## Overview
This guide explains how to set up and use the Mapbox MCP (Model Context Protocol) server with Claude Desktop. The MCP server enables Claude to directly interact with Mapbox APIs, providing enhanced mapping capabilities.

## 🚀 Quick Start

### Prerequisites
- Claude Desktop installed
- Node.js and npm installed
- Mapbox account with access token
- Project environment configured

### 1. Configuration Files
The MCP server configuration is already set up in two locations:

#### Global Configuration (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "MapboxServer": {
      "command": "npx",
      "args": [ "-y", "@mapbox/mcp-server"],
      "env": {
        "MAPBOX_ACCESS_TOKEN": "pk.eyJ1Ijoia2F6dTE5ODgiLCJhIjoiY21jeWk4NXRxMGw3cDJtc2FpdzFhMHgxMSJ9.4K43teNcQ1dcDqncY6FckA"
      }
    }
  }
}
```

#### Project-Specific Configuration (`.clauderc`)
Same configuration as above, but specific to this project.

### 2. Environment Variables
The following environment variables are configured:

```bash
# Client-side Mapbox token
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoia2F6dTE5ODgiLCJhIjoiY21jeWk4NXRxMGw3cDJtc2FpdzFhMHgxMSJ9.4K43teNcQ1dcDqncY6FckA

# MCP server Mapbox token
MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoia2F6dTE5ODgiLCJhIjoiY21jeWk4NXRxMGw3cDJtc2FpdzFhMHgxMSJ9.4K43teNcQ1dcDqncY6FckA
```

## 📋 Setup Steps

### Step 1: Install MCP Server
The MCP server is automatically installed when needed via `npx -y @mapbox/mcp-server`.

### Step 2: Configure Claude Desktop
1. **Option A: Use Global Configuration**
   - Copy `claude_desktop_config.json` to your user directory
   - Location varies by OS:
     - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
     - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
     - Linux: `~/.config/claude/claude_desktop_config.json`

2. **Option B: Use Project Configuration**
   - The `.clauderc` file is already in the project root
   - Claude Desktop will automatically detect it

### Step 3: Restart Claude Desktop
After configuration, restart Claude Desktop to load the MCP server.

### Step 4: Verify Setup
Check that the MCP server is running:
```bash
npm run test-mcp
```

## 🔧 Available Commands

### NPM Scripts
```bash
# Start MCP server manually
npm run mcp-server

# Test MCP server configuration
npm run test-mcp

# Test Mapbox integration
npm run test-mapbox

# Validate all environment variables
npm run validate-env
```

### MCP Server Commands
Once the MCP server is running, Claude can access these Mapbox capabilities:

#### Geocoding
- Forward geocoding (address to coordinates)
- Reverse geocoding (coordinates to address)
- Batch geocoding operations

#### Directions
- Route calculation between waypoints
- Alternative route suggestions
- Turn-by-turn navigation instructions

#### Maps
- Static map generation
- Style information retrieval
- Tileset management

#### Places
- Places search and discovery
- Place details and metadata
- Business listings

## 🎯 Usage Examples

### Basic Geocoding
```
Claude can now geocode addresses directly:
"Can you find the coordinates for Tokyo Station?"
```

### Route Planning
```
"Plan a route from Tokyo Station to Shibuya Station and show me the driving directions."
```

### Map Generation
```
"Generate a static map showing the area around Tokyo Tower with markers."
```

### Places Search
```
"Find restaurants within 1km of Tokyo Skytree."
```

## 🔍 Troubleshooting

### Common Issues

#### MCP Server Not Starting
**Symptoms:** Claude doesn't recognize Mapbox commands
**Solutions:**
1. Verify configuration files are in correct locations
2. Check environment variables are set
3. Restart Claude Desktop
4. Run `npm run test-mcp` for diagnostics

#### Token Issues
**Symptoms:** Authentication errors in MCP server
**Solutions:**
1. Verify token format (starts with `pk.`)
2. Check token permissions in Mapbox dashboard
3. Ensure token is not expired
4. Test token with `npm run test-mapbox`

#### Package Installation Issues
**Symptoms:** `@mapbox/mcp-server` not found
**Solutions:**
1. Check internet connection
2. Verify npm/npx is installed
3. Clear npm cache: `npm cache clean --force`
4. Try manual installation: `npm install -g @mapbox/mcp-server`

### Debug Mode
Enable debug logging by adding to your configuration:
```json
{
  "mcpServers": {
    "MapboxServer": {
      "command": "npx",
      "args": [ "-y", "@mapbox/mcp-server", "--debug"],
      "env": {
        "MAPBOX_ACCESS_TOKEN": "pk.eyJ1Ijoia2F6dTE5ODgiLCJhIjoiY21jeWk4NXRxMGw3cDJtc2FpdzFhMHgxMSJ9.4K43teNcQ1dcDqncY6FckA",
        "DEBUG": "true"
      }
    }
  }
}
```

## 🔒 Security Considerations

### Token Security
- Never commit tokens to version control
- Use environment variables for token management
- Rotate tokens regularly
- Monitor token usage in Mapbox dashboard

### MCP Server Security
- MCP servers run locally with your permissions
- Tokens are only accessible to the MCP server process
- No remote access to your tokens

## 📊 Monitoring

### Check Server Status
```bash
# Test MCP server functionality
npm run test-mcp

# Check Mapbox API connectivity
npm run test-mapbox

# Validate environment setup
npm run validate-env
```

### Log Analysis
- MCP server logs appear in Claude Desktop console
- Enable debug mode for detailed logging
- Check system logs for process errors

## 🔄 Maintenance

### Regular Tasks
1. **Monthly**: Check token expiration
2. **Weekly**: Review MCP server logs
3. **Daily**: Monitor API usage

### Updates
- MCP server is updated automatically via `npx -y`
- Configuration files are versioned with project
- Environment variables should be kept current

## 📚 Additional Resources

- [Mapbox MCP Server Documentation](https://docs.mapbox.com/help/guides/mcp-server/)
- [Claude Desktop MCP Configuration](https://docs.anthropic.com/claude/docs/mcp)
- [Mapbox API Documentation](https://docs.mapbox.com/api/)
- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)

## 🆘 Support

If you encounter issues:
1. Run diagnostic tests: `npm run test-mcp`
2. Check configuration files
3. Verify environment variables
4. Review Claude Desktop logs
5. Consult troubleshooting section above

---

*This guide is maintained alongside the project and updated when MCP configuration changes.*