import { Router, Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { apiKeyService } from '../services/apiKeyService';
import { ApiKeyPermission } from '../models/ApiKey';

const router = Router();

/**
 * Auth middleware for API key management routes
 * These routes require JWT authentication (the user manages their own keys)
 */
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }
  next();
};

// All key management routes require auth
router.use(requireAuth);

/**
 * POST /api/keys
 * Create a new API key
 */
router.post(
  '/',
  [
    body('name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters'),
    body('permissions')
      .isArray({ min: 1 })
      .withMessage('At least one permission is required'),
    body('permissions.*')
      .isIn([
        'read:proofs',
        'write:proofs',
        'read:analytics',
        'read:users',
        'write:users',
        'read:webhooks',
        'write:webhooks',
        'admin',
      ])
      .withMessage('Invalid permission scope'),
    body('rateLimit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Rate limit must be between 1 and 1000'),
    body('expiresInDays')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Expiry must be between 1 and 365 days'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }

    try {
      const userId = (req as any).user.id;
      const { name, permissions, rateLimit, expiresInDays } = req.body;

      const { apiKey, rawKey } = await apiKeyService.createApiKey({
        name,
        ownerId: userId,
        permissions,
        rateLimit,
        expiresInDays,
      });

      // Return the raw key only on creation
      res.status(201).json({
        success: true,
        message: 'API key created successfully. Store this key securely - it will not be shown again.',
        data: {
          id: apiKey.id,
          name: apiKey.name,
          keyPrefix: apiKey.keyPrefix,
          apiKey: rawKey,
          permissions: apiKey.permissions,
          rateLimit: apiKey.rateLimit,
          expiresAt: apiKey.expiresAt,
          createdAt: apiKey.createdAt,
        },
      });
    } catch (error) {
      console.error('Error creating API key:', error);
      res.status(500).json({ success: false, error: 'Failed to create API key' });
    }
  }
);

/**
 * GET /api/keys
 * List all API keys for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const keys = await apiKeyService.listApiKeys(userId);

    res.json({
      success: true,
      data: keys,
      total: keys.length,
    });
  } catch (error) {
    console.error('Error listing API keys:', error);
    res.status(500).json({ success: false, error: 'Failed to list API keys' });
  }
});

/**
 * GET /api/keys/:id
 * Get a single API key by ID
 */
router.get(
  '/:id',
  [query('id').isString().withMessage('Key ID is required')],
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const apiKey = await apiKeyService.getApiKey(id, userId);

      if (!apiKey) {
        return res.status(404).json({ success: false, error: 'API key not found' });
      }

      res.json({ success: true, data: apiKey });
    } catch (error) {
      console.error('Error getting API key:', error);
      res.status(500).json({ success: false, error: 'Failed to get API key' });
    }
  }
);

/**
 * PUT /api/keys/:id
 * Update an API key (name, permissions, rate limit)
 */
router.put(
  '/:id',
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters'),
    body('permissions')
      .optional()
      .isArray({ min: 1 })
      .withMessage('At least one permission is required'),
    body('permissions.*')
      .optional()
      .isIn([
        'read:proofs',
        'write:proofs',
        'read:analytics',
        'read:users',
        'write:users',
        'read:webhooks',
        'write:webhooks',
        'admin',
      ])
      .withMessage('Invalid permission scope'),
    body('rateLimit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Rate limit must be between 1 and 1000'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }

    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const updated = await apiKeyService.updateApiKey(id, userId, req.body);

      if (!updated) {
        return res.status(404).json({ success: false, error: 'API key not found' });
      }

      res.json({ success: true, message: 'API key updated', data: updated });
    } catch (error) {
      console.error('Error updating API key:', error);
      res.status(500).json({ success: false, error: 'Failed to update API key' });
    }
  }
);

/**
 * DELETE /api/keys/:id
 * Revoke an API key
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const revoked = await apiKeyService.revokeApiKey(id, userId);

    if (!revoked) {
      return res.status(404).json({ success: false, error: 'API key not found or already revoked' });
    }

    res.json({ success: true, message: 'API key revoked successfully' });
  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke API key' });
  }
});

/**
 * POST /api/keys/:id/rotate
 * Rotate an API key (revoke old, create new)
 */
router.post('/:id/rotate', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const result = await apiKeyService.rotateApiKey(id, userId);

    if (!result) {
      return res.status(404).json({ success: false, error: 'API key not found or already revoked' });
    }

    res.json({
      success: true,
      message: 'API key rotated successfully. Store this new key securely - it will not be shown again.',
      data: {
        id: result.apiKey.id,
        name: result.apiKey.name,
        keyPrefix: result.apiKey.keyPrefix,
        apiKey: result.rawKey,
        permissions: result.apiKey.permissions,
        rateLimit: result.apiKey.rateLimit,
        expiresAt: result.apiKey.expiresAt,
        createdAt: result.apiKey.createdAt,
      },
    });
  } catch (error) {
    console.error('Error rotating API key:', error);
    res.status(500).json({ success: false, error: 'Failed to rotate API key' });
  }
});

export default router;
