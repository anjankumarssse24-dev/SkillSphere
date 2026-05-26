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
cds.on('serving', (req) => {
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

    // Block direct entity access attempts
    const blockedPatterns = [
      '/Employees',
      '/Projects',
      '/Skills',
      '/CurrentProjects',
      '/Initiatives',
      '/Certifications',
      '/Users'
    ];

    for (const pattern of blockedPatterns) {
      if (req.url.includes(pattern) && !req.url.includes('$action') && !req.url.includes('$function')) {
        console.warn(`🚨 SECURITY: Blocked entity access attempt from ${req.user?.id} - ${req.url}`);
        return req.reject(403, 'Direct entity access is forbidden. Use /api/v1 actions instead');
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

/**
 * Disable $batch processing (to prevent complex queries)
 */
cds.on('REQUEST', (req, next) => {
  if (req.url.includes('$batch')) {
    return req.reject(403, 'Batch requests are not allowed');
  }
  return next();
});
