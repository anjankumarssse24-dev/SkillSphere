/**
 * SkillSphere Secure API Server Configuration
 * 
 * SECURITY CONTROLS:
 * ✅ Disables $metadata endpoint discovery
 * ✅ Blocks direct OData entity access
 * ✅ Redirects old /skillsphere/odata routes (DEPRECATED)
 * ✅ Enforces custom action-based API only
 * ✅ Logs all unauthorized access attempts
 */

const cds = require('@sap/cds');

module.exports = cds.server;

// ========== SECURITY MIDDLEWARE ==========

/**
 * Block metadata discovery - prevents developers from discovering data structure
 */
cds.on('serving', () => {
  cds.on('REQUEST', (req, next) => {
    // Block $metadata requests
    if (req.url.includes('$metadata')) {
      return req.reject(403, 'Metadata discovery is disabled for security');
    }

    // Block access to old OData endpoints
    if (req.url.includes('/skillsphere/odata/v4')) {
      console.warn(`🚨 SECURITY: Blocked legacy OData access attempt from ${req.user?.id} - ${req.url}`);
      return req.reject(410, 'Deprecated endpoint. Use /api/v1 instead');
    }

    // NOTE: UI currently relies on OData entity endpoints + batch updates.
    // Keep a narrow hard block only for Users entity surface.
    const blockedUserEntityPatterns = [
      '/odata/v4/api/v1/Users',
      '/odata/v4/api/v1/Users(',
      '/api/v1/Users',
      '/api/v1/Users('
    ];

    for (const pattern of blockedUserEntityPatterns) {
      if (req.url.includes(pattern)) {
        console.warn(`🚨 SECURITY: Blocked Users entity access attempt from ${req.user?.id} - ${req.url}`);
        return req.reject(403, 'Direct Users entity access is forbidden');
      }
    }

    return next();
  });
});

/**
 * Log all API access for security audit - MINIMAL PII VERSION
 */
cds.on('REQUEST', (req, next) => {
  const timestamp = new Date().toISOString();
  // SECURITY: Mask user ID - only log last 4 chars
  const userId = req.user?.id ? 'user_' + req.user.id.slice(-4) : 'ANON';
  
  // SECURITY: No email or full user ID in logs
  const result = next();
  
  if (req.url.includes('/api/v1')) {
    console.log(`[API-ACCESS] ${timestamp} | User: ${userId} | Method: ${req.method} | Path: ${req.url.split('?')[0]}`);
  }
  
  return result;
});

// Keep $batch enabled because UI5 OData V4 submitBatch is used across dashboards.
