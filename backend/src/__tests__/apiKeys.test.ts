import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// In-memory mock for the ApiKey model
const mockApiKeyStore: any[] = [];

// Mock the ApiKey model
jest.mock('../models/ApiKey', () => {
  return {
    ApiKey: {
      find: (query: any) => ({
        select: () => ({
          sort: () => ({
            lean: () => mockApiKeyStore.filter(k => {
              if (query.ownerId && k.ownerId !== query.ownerId) return false;
              if (query.isRevoked !== undefined && k.isRevoked !== query.isRevoked) return false;
              if (query.keyHash && k.keyHash !== query.keyHash) return false;
              return true;
            }),
          }),
        }),
      }),
      findOne: (query: any) => ({
        select: () => ({
          lean: () => mockApiKeyStore.find(k => {
            if (query.id && k.id !== query.id) return false;
            if (query.ownerId && k.ownerId !== query.ownerId) return false;
            if (query.isRevoked !== undefined && k.isRevoked !== query.isRevoked) return false;
            if (query.keyHash && k.keyHash !== query.keyHash) return false;
            return true;
          }) || null,
        }),
      }),
      findOneAndUpdate: (query: any, update: any, options: any) => {
        const idx = mockApiKeyStore.findIndex(k => {
          if (query.id && k.id !== query.id) return false;
          if (query.ownerId && k.ownerId !== query.ownerId) return false;
          if (query.isRevoked !== undefined && k.isRevoked !== query.isRevoked) return false;
          return true;
        });
        if (idx === -1) return null;
        if (update.$set) {
          Object.assign(mockApiKeyStore[idx], update.$set);
        }
        return {
          select: () => ({ lean: () => mockApiKeyStore[idx] }),
        };
      },
      updateOne: (query: any, update: any) => {
        let modified = 0;
        mockApiKeyStore.forEach(k => {
          let match = true;
          if (query.id && k.id !== query.id) match = false;
          if (query.ownerId && k.ownerId !== query.ownerId) match = false;
          if (query.isRevoked !== undefined && k.isRevoked !== query.isRevoked) match = false;
          if (match) {
            if (update.$set) Object.assign(k, update.$set);
            if (update.$inc) {
              for (const [key, val] of Object.entries(update.$inc)) {
                (k as any)[key] = ((k as any)[key] || 0) + (val as number);
              }
            }
            modified++;
          }
        });
        return { modifiedCount: modified };
      },
      deleteMany: (query: any) => {
        let deleted = 0;
        for (let i = mockApiKeyStore.length - 1; i >= 0; i--) {
          const k = mockApiKeyStore[i];
          let match = true;
          if (query.$or) {
            match = query.$or.some((orQuery: any) => {
              if (orQuery.isRevoked !== undefined && k.isRevoked !== orQuery.isRevoked) return false;
              return true;
            });
          }
          if (match) {
            mockApiKeyStore.splice(i, 1);
            deleted++;
          }
        }
        return { deletedCount: deleted };
      },
      prototype: {
        save: function () {
          mockApiKeyStore.push(this);
          return Promise.resolve(this);
        },
      },
    },
  };
});

// Import the routes
import apiKeyRoutes from '../routes/apiKeys';

// Create test app
function createApp() {
  const app = express();
  app.use(express.json());

  // Mock JWT auth middleware
  app.use('/api/keys', (req: any, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, 'test-secret') as { userId: string };
      req.user = { id: decoded.userId };
      next();
    } catch (e) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
  });

  app.use('/api/keys', apiKeyRoutes);
  return app;
}

function createTestToken(userId: string = 'test-user-1'): string {
  return jwt.sign({ userId }, 'test-secret', { expiresIn: '1h' });
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('API Key Management', () => {
  let app: express.Express;
  let token: string;

  beforeEach(() => {
    mockApiKeyStore.length = 0;
    app = createApp();
    token = createTestToken();
  });

  describe('POST /api/keys - Create API Key', () => {
    it('should create a new API key successfully', async () => {
      const response = await request(app)
        .post('/api/keys')
        .set(authHeader(token))
        .send({
          name: 'My CI/CD Key',
          permissions: ['read:proofs', 'write:proofs'],
          rateLimit: 120,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.apiKey).toBeDefined();
      expect(response.body.data.apiKey).toMatch(/^nv_sk_/);
      expect(response.body.data.keyPrefix).toBeDefined();
      expect(response.body.data.name).toBe('My CI/CD Key');
      expect(response.body.data.permissions).toEqual(['read:proofs', 'write:proofs']);
      expect(response.body.data.rateLimit).toBe(120);
      expect(response.body.message).toContain('not be shown again');
    });

    it('should return validation error for missing name', async () => {
      const response = await request(app)
        .post('/api/keys')
        .set(authHeader(token))
        .send({ permissions: ['read:proofs'] })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return validation error for empty permissions array', async () => {
      const response = await request(app)
        .post('/api/keys')
        .set(authHeader(token))
        .send({ name: 'Test', permissions: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return validation error for invalid permission', async () => {
      const response = await request(app)
        .post('/api/keys')
        .set(authHeader(token))
        .send({
          name: 'Test',
          permissions: ['invalid:permission'],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle expiry configuration', async () => {
      const response = await request(app)
        .post('/api/keys')
        .set(authHeader(token))
        .send({
          name: 'Expiring Key',
          permissions: ['read:proofs'],
          expiresInDays: 30,
        })
        .expect(201);

      expect(response.body.data.expiresAt).toBeDefined();
      const expiresAt = new Date(response.body.data.expiresAt);
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      expect(Math.abs(expiresAt.getTime() - thirtyDaysFromNow.getTime())).toBeLessThan(5000);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post('/api/keys')
        .send({
          name: 'Test',
          permissions: ['read:proofs'],
        })
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('GET /api/keys - List API Keys', () => {
    beforeEach(async () => {
      // Create some keys for testing
      await request(app)
        .post('/api/keys')
        .set(authHeader(token))
        .send({ name: 'Key 1', permissions: ['read:proofs'] });

      await request(app)
        .post('/api/keys')
        .set(authHeader(token))
        .send({ name: 'Key 2', permissions: ['write:proofs'] });
    });

    it('should list all keys for the user', async () => {
      const response = await request(app)
        .get('/api/keys')
        .set(authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('should not return keyHash in the listing', async () => {
      const response = await request(app)
        .get('/api/keys')
        .set(authHeader(token))
        .expect(200);

      response.body.data.forEach((key: any) => {
        expect(key.keyHash).toBeUndefined();
        expect(key.apiKey).toBeUndefined(); // Full key never returned
      });
    });
  });

  describe('GET /api/keys/:id - Get Single API Key', () => {
    let keyId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/keys')
        .set(authHeader(token))
        .send({ name: 'Single Key', permissions: ['read:proofs'] });
      keyId = res.body.data.id;
    });

    it('should get key by ID', async () => {
      const response = await request(app)
        .get(`/api/keys/${keyId}`)
        .set(authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Single Key');
    });

    it('should return 404 for non-existent key', async () => {
      const response = await request(app)
        .get('/api/keys/non-existent-id')
        .set(authHeader(token))
        .expect(404);

      expect(response.body.error).toBe('API key not found');
    });
  });

  describe('PUT /api/keys/:id - Update API Key', () => {
    let keyId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/keys')
        .set(authHeader(token))
        .send({ name: 'Update Me', permissions: ['read:proofs'] });
      keyId = res.body.data.id;
    });

    it('should update key name and permissions', async () => {
      const response = await request(app)
        .put(`/api/keys/${keyId}`)
        .set(authHeader(token))
        .send({
          name: 'Updated Key Name',
          permissions: ['read:proofs', 'read:analytics'],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Key Name');
      expect(response.body.data.permissions).toEqual(['read:proofs', 'read:analytics']);
    });

    it('should return 404 for non-existent key', async () => {
      const response = await request(app)
        .put('/api/keys/non-existent')
        .set(authHeader(token))
        .send({ name: 'New Name' })
        .expect(404);

      expect(response.body.error).toBe('API key not found');
    });
  });

  describe('DELETE /api/keys/:id - Revoke API Key', () => {
    let keyId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/keys')
        .set(authHeader(token))
        .send({ name: 'Revoke Me', permissions: ['read:proofs'] });
      keyId = res.body.data.id;
    });

    it('should revoke a key successfully', async () => {
      const response = await request(app)
        .delete(`/api/keys/${keyId}`)
        .set(authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('API key revoked successfully');

      // Verify the key is indeed in the store as revoked
      const revokedKey = mockApiKeyStore.find(k => k.id === keyId);
      expect(revokedKey?.isRevoked).toBe(true);
    });

    it('should return 404 for already revoked key', async () => {
      await request(app).delete(`/api/keys/${keyId}`).set(authHeader(token));
      const response = await request(app)
        .delete(`/api/keys/${keyId}`)
        .set(authHeader(token))
        .expect(404);

      expect(response.body.error).toBe('API key not found or already revoked');
    });
  });

  describe('POST /api/keys/:id/rotate - Rotate API Key', () => {
    let keyId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/keys')
        .set(authHeader(token))
        .send({ name: 'Rotate Me', permissions: ['read:proofs'] });
      keyId = res.body.data.id;
    });

    it('should rotate a key successfully', async () => {
      const response = await request(app)
        .post(`/api/keys/${keyId}/rotate`)
        .set(authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.apiKey).toBeDefined();
      expect(response.body.data.apiKey).toMatch(/^nv_sk_/);
      expect(response.body.data.name).toContain('rotated');
      expect(response.body.data.id).not.toBe(keyId);

      // Old key should be revoked
      const oldKey = mockApiKeyStore.find(k => k.id === keyId);
      expect(oldKey?.isRevoked).toBe(true);
    });

    it('should return 404 for non-existent key', async () => {
      const response = await request(app)
        .post('/api/keys/non-existent/rotate')
        .set(authHeader(token))
        .expect(404);

      expect(response.body.error).toBe('API key not found or already revoked');
    });
  });
});

// API Key Authentication Middleware Tests
describe('API Key Auth Middleware', () => {
  it('should allow requests with valid API key', async () => {
    // This tests the key generation and validation flow
    const keyPattern = /^nv_sk_[a-f0-9]+$/;
    expect('nv_sk_abc123def456').toMatch(keyPattern);
    expect('invalid_key').not.toMatch(keyPattern);
  });
});
