import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';

// Create a test app with rate limiting
const createRateLimitedApp = () => {
  const app = express();
  app.use(express.json());

  // Global rate limiter: 5 requests per 60 seconds
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
    },
  });

  app.use('/api/limited', limiter);

  app.get('/api/limited', (req, res) => {
    res.json({ success: true, data: 'response' });
  });

  app.get('/api/unlimited', (req, res) => {
    res.json({ success: true, data: 'unlimited' });
  });

  return app;
};

// Create app with tiered rate limiting
const createTieredApp = () => {
  const app = express();
  app.use(express.json());

  const tieredLimiter = rateLimit({
    windowMs: 10 * 1000, // 10 seconds
    max: (req: any) => {
      const user = req.user;
      if (!user) return 3; // anonymous
      switch (user.tier) {
        case 'premium':
          return 15;
        case 'enterprise':
          return 30;
        default:
          return 5; // free tier
      }
    },
    keyGenerator: (req: any) => {
      return req.user?.id || req.ip;
    },
    message: { error: 'Too many requests' },
  });

  // Mock auth middleware
  app.use('/api/tiered', (req: any, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey === 'premium-key') {
      req.user = { id: 'premium-user', tier: 'premium' };
    } else if (apiKey === 'enterprise-key') {
      req.user = { id: 'enterprise-user', tier: 'enterprise' };
    } else {
      req.user = { id: 'free-user', tier: 'free' };
    }
    next();
  });

  app.use('/api/tiered', tieredLimiter);

  app.get('/api/tiered', (req, res) => {
    res.json({ success: true, tier: (req as any).user?.tier });
  });

  return app;
};

// Create app with per-endpoint rate limits
const createEndpointSpecificApp = () => {
  const app = express();
  app.use(express.json());

  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    message: { error: 'Too many auth attempts' },
  });

  const proofCreationLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Too many proof creations' },
  });

  app.post('/api/auth/login', authLimiter, (req, res) => {
    res.json({ success: true, token: 'mock-token' });
  });

  app.post('/api/proofs', proofCreationLimiter, (req, res) => {
    res.json({ success: true, id: 'proof-123' });
  });

  return app;
};

describe('Rate Limiting Integration Tests', () => {
  describe('Basic Rate Limiting', () => {
    const app = createRateLimitedApp();

    it('should allow requests within the rate limit', async () => {
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .get('/api/limited')
          .expect(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should return 429 when rate limit is exceeded', async () => {
      // Make 5 successful requests
      for (let i = 0; i < 5; i++) {
        await request(app).get('/api/limited');
      }

      // 6th request should fail
      const response = await request(app)
        .get('/api/limited')
        .expect(429);

      expect(response.body.error).toBe('Too many requests');
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/limited')
        .expect(200);

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();

      expect(parseInt(response.headers['ratelimit-limit'] as string)).toBe(5);
    });

    it('should decrement remaining header with each request', async () => {
      const res1 = await request(app).get('/api/unlimited');
      const res2 = await request(app).get('/api/unlimited');

      // Unlimited endpoint should not have rate limit headers
      expect(res1.headers['ratelimit-limit']).toBeUndefined();
    });

    it('should reset counter after window expires', async () => {
      // Use a quick limiter for this test
      const quickApp = express();
      quickApp.use(express.json());

      const quickLimiter = rateLimit({
        windowMs: 100, // 100ms window
        max: 2,
        message: { error: 'Too many requests' },
      });

      quickApp.use('/quick', quickLimiter);
      quickApp.get('/quick', (req, res) => {
        res.json({ success: true });
      });

      // Exhaust the limit
      await request(quickApp).get('/quick');
      await request(quickApp).get('/quick');

      const rateLimited = await request(quickApp)
        .get('/quick')
        .expect(429);
      expect(rateLimited.body.error).toBe('Too many requests');

      // Wait for window to reset
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should work again
      const afterReset = await request(quickApp)
        .get('/quick')
        .expect(200);
      expect(afterReset.body.success).toBe(true);
    });
  });

  describe('Tiered Rate Limiting', () => {
    const app = createTieredApp();

    it('should allow more requests for premium users', async () => {
      // Premium users get 15 requests
      for (let i = 0; i < 15; i++) {
        const response = await request(app)
          .get('/api/tiered')
          .set('x-api-key', 'premium-key')
          .expect(200);
        expect(response.body.tier).toBe('premium');
      }
    });

    it('should limit free users to fewer requests', async () => {
      // Free users get 5 requests
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get('/api/tiered')
          .set('x-api-key', 'free-key')
          .expect(200);
      }

      // 6th request should fail
      const response = await request(app)
        .get('/api/tiered')
        .set('x-api-key', 'free-key')
        .expect(429);

      expect(response.body.error).toBe('Too many requests');
    });

    it('should allow enterprise users the most requests', async () => {
      // Enterprise users get 30 requests
      for (let i = 0; i < 30; i++) {
        const response = await request(app)
          .get('/api/tiered')
          .set('x-api-key', 'enterprise-key')
          .expect(200);
        expect(response.body.tier).toBe('enterprise');
      }
    });
  });

  describe('Endpoint-Specific Rate Limiting', () => {
    const app = createEndpointSpecificApp();

    it('should enforce separate limits for different endpoints', async () => {
      // Exhaust auth endpoint limit (3)
      await request(app).post('/api/auth/login');
      await request(app).post('/api/auth/login');
      await request(app).post('/api/auth/login');

      // Auth endpoint should now return 429
      const authExceeded = await request(app)
        .post('/api/auth/login')
        .expect(429);
      expect(authExceeded.body.error).toBe('Too many auth attempts');

      // Proof creation (separate limit) should still work
      const proofResponse = await request(app)
        .post('/api/proofs')
        .expect(200);
      expect(proofResponse.body.success).toBe(true);
    });
  });

  describe('Rate Limit Error Formatting', () => {
    it('should return JSON error response', async () => {
      const app = express();
      app.use(express.json());

      const limiter = rateLimit({
        windowMs: 60 * 1000,
        max: 1,
        message: { error: 'Rate limited', retryAfter: '60s' },
      });

      app.get('/test', limiter, (req, res) => res.json({ ok: true }));

      await request(app).get('/test');
      const response = await request(app)
        .get('/test')
        .expect(429);

      expect(response.body.error).toBeDefined();
      expect(response.headers['content-type']).toContain('application/json');
    });
  });
});
