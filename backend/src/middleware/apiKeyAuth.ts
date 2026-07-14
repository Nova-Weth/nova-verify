import { Request, Response, NextFunction } from 'express';
import { apiKeyService } from '../services/apiKeyService';
import { ApiKeyPermission } from '../models/ApiKey';
import rateLimit from 'express-rate-limit';

// In-memory store for per-key rate limiting
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Clean up expired rate limit entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

/**
 * API Key Authentication Middleware
 *
 * Authenticates requests using the X-API-Key header.
 * Falls through to next middleware if no API key is present
 * (allowing JWT auth to handle the request).
 */
export const apiKeyAuth = (requiredPermission?: ApiKeyPermission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string;

    // If no API key, skip to next auth middleware (JWT)
    if (!apiKey) {
      return next();
    }

    try {
      const validKey = await apiKeyService.validateApiKey(apiKey);

      if (!validKey) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired API key',
          timestamp: new Date().toISOString(),
        });
      }

      // Check permissions if required
      if (requiredPermission && !apiKeyService.hasPermission(validKey, requiredPermission)) {
        return res.status(403).json({
          success: false,
          error: `API key lacks required permission: ${requiredPermission}`,
          timestamp: new Date().toISOString(),
        });
      }

      // Apply per-key rate limiting
      const rateLimitResult = checkPerKeyRateLimit(validKey.id, validKey.rateLimit);
      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          success: false,
          error: 'API key rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter,
          timestamp: new Date().toISOString(),
        });
      }

      // Attach API key info to request
      (req as any).apiKey = {
        id: validKey.id,
        name: validKey.name,
        ownerId: validKey.ownerId,
        permissions: validKey.permissions,
      };

      // Also set user context for downstream handlers
      (req as any).user = (req as any).user || {};
      (req as any).user.id = validKey.ownerId;
      (req as any).user.authMethod = 'api_key';

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', validKey.rateLimit.toString());
      res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
      res.setHeader('X-RateLimit-Reset', rateLimitResult.resetAt.toString());

      next();
    } catch (error) {
      console.error('API key auth error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error during API key authentication',
        timestamp: new Date().toISOString(),
      });
    }
  };
};

/**
 * Check per-API-key rate limiting
 */
function checkPerKeyRateLimit(
  keyId: string,
  limitPerMinute: number
): { allowed: boolean; remaining: number; resetAt: number; retryAfter?: string } {
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const entry = rateLimitStore.get(keyId);

  if (!entry || entry.resetAt < now) {
    // Start new window
    rateLimitStore.set(keyId, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limitPerMinute - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limitPerMinute) {
    const retryAfterMs = entry.resetAt - now;
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: `${Math.ceil(retryAfterMs / 1000)}s`,
    };
  }

  entry.count++;
  rateLimitStore.set(keyId, entry);
  return {
    allowed: true,
    remaining: limitPerMinute - entry.count,
    resetAt: entry.resetAt,
  };
}

export default apiKeyAuth;
