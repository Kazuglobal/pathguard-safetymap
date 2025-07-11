# Mapbox Integration Guide

## Overview
This guide provides comprehensive information about the Mapbox integration in this application, including troubleshooting steps and best practices.

## 🔧 Configuration

### Environment Variables
```bash
# Required for all Mapbox functionality
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijo...
```

### Token Requirements
- Must start with `pk.` (public token)
- Must have access to Mapbox Styles API
- Required scopes: `styles:read`

## 🏗️ Architecture

### Core Components
1. **`lib/mapbox-config.ts`** - Token validation and configuration
2. **`lib/mapbox-logger.ts`** - Enhanced error monitoring
3. **`lib/rate-limiter.ts`** - API rate limiting
4. **`components/map/mapbox-error-boundary.tsx`** - Error handling UI

### Map Components
1. **`components/map/map-container.tsx`** - Main map container
2. **`components/map/school-traffic-viewer.tsx`** - Traffic data visualization
3. **`components/map/map-wrapper.tsx`** - Map wrapper component

## 🚀 Features

### Token Validation
- Real-time token validation
- Scope verification
- Style access testing
- Caching for performance

### Error Handling
- Comprehensive error logging
- User-friendly error messages
- Automatic fallback mechanisms
- Rate limit detection

### Rate Limiting
- Client-side rate limiting
- Exponential backoff
- Request queuing
- Automatic retry logic

### Monitoring
- Error tracking
- Performance metrics
- User session tracking
- Debug information

## 🔍 Debugging

### Debug Endpoint
Visit `/api/debug/mapbox` to get detailed information about:
- Token validation status
- Style access permissions
- HTTPS configuration
- Recent errors

### Testing Commands
```bash
# Validate environment variables
npm run validate-env

# Test Mapbox integration
npm run test-mapbox

# Run type checking
npm run typecheck
```

### Common Issues

#### "Invalid Mapbox access token" Error
**Symptoms:** Map fails to load with token error
**Solutions:**
1. Verify token is set in environment variables
2. Check token format (must start with `pk.`)
3. Verify token has required scopes
4. Check debug endpoint for detailed error info

#### Rate Limit Exceeded
**Symptoms:** Intermittent loading failures
**Solutions:**
1. Monitor API usage
2. Implement request caching
3. Optimize API calls
4. Consider upgrading Mapbox plan

#### HTTPS Required
**Symptoms:** Token works locally but fails in production
**Solutions:**
1. Ensure production uses HTTPS
2. Check CDN configuration
3. Verify SSL certificates

## 📊 Monitoring

### Log Levels
- `error` - Critical issues requiring immediate attention
- `warn` - Potential issues that should be monitored
- `info` - General information about operations
- `debug` - Detailed debugging information

### Key Metrics
- Token validation success rate
- Style loading performance
- Error frequency by type
- Rate limit hit frequency

## 🔄 Maintenance

### Regular Tasks
1. Monitor token expiration
2. Review error logs weekly
3. Check rate limit usage
4. Update dependencies

### Token Rotation
1. Generate new token in Mapbox dashboard
2. Update environment variables
3. Deploy application
4. Verify functionality
5. Revoke old token

## 🚨 Troubleshooting Checklist

### Before Deployment
- [ ] Environment variables are set
- [ ] Token validation passes
- [ ] All tests pass
- [ ] TypeScript compilation succeeds
- [ ] Rate limiting is configured

### After Deployment
- [ ] Debug endpoint responds correctly
- [ ] Maps load successfully
- [ ] No errors in production logs
- [ ] Performance metrics are acceptable
- [ ] HTTPS is working correctly

## 🔗 Useful Links

- [Mapbox Documentation](https://docs.mapbox.com/)
- [Token Troubleshooting](https://docs.mapbox.com/help/troubleshooting/access-token-troubleshooting/)
- [API Rate Limits](https://docs.mapbox.com/api/overview/#rate-limits)
- [Mapbox Dashboard](https://account.mapbox.com/)

## 📝 Support

If you encounter issues:
1. Check the debug endpoint: `/api/debug/mapbox`
2. Review application logs
3. Run the test suite: `npm run test-mapbox`
4. Check this troubleshooting guide
5. Contact the development team

## 🏷️ Version Information

- **Integration Version:** 2.0.0
- **Mapbox GL JS:** Latest
- **Last Updated:** January 2025
- **Token Format:** pk.* (public token)

---

*This guide is automatically updated when the integration changes.*